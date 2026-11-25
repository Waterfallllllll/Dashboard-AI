import { readApiEnv, type ApiRuntime } from "../config/env.js";
import { createCredentialCipher, readDataEncryptionKey } from "../infrastructure/crypto/index.js";
import { purgeAccount } from "../infrastructure/db/account-purge.js";
import {
  connectDatabase,
  disconnectPrisma,
  getPrismaClient
} from "../infrastructure/db/prisma-client.js";
import type { PrismaClient } from "../generated/prisma/client.js";
import { PrismaJobQueue } from "../infrastructure/jobs/prisma-job-queue.js";
import type { JobQueue } from "../infrastructure/jobs/memory-job-queue.js";
import type { Logger } from "../infrastructure/logging/logger.js";
import { createLogger } from "../infrastructure/logging/logger.js";
import { createMetrics, type MetricsSource } from "../infrastructure/metrics/app-metrics.js";
import { PrismaAuthRepository } from "../modules/auth/prisma-auth.repository.js";
import { AuthService } from "../modules/auth/auth.service.js";
import { AuditService } from "../modules/audit/audit.service.js";
import { PrismaAuditRepository } from "../modules/audit/prisma-audit.repository.js";
import { createGoogleOAuthClient } from "../modules/auth/google-oauth.js";
import { PrismaCalendarRepository } from "../modules/calendar/prisma-calendar.repository.js";
import { renewCalendarWatches } from "../modules/calendar/calendar-watch.js";
import {
  createGoogleCalendarGateway,
  type CalendarWatchGateway
} from "../modules/calendar/google-calendar-gateway.js";
import { createExternalServices, type ExternalServices } from "../modules/external-services.js";
import { createCalendarOAuthClient } from "../modules/integrations/google-calendar-oauth.js";
import { PrismaIntegrationsRepository } from "../modules/integrations/prisma-integrations.repository.js";
import type { IntegrationsRepository } from "../modules/integrations/integrations.repository.js";
import { TelegramClient } from "../modules/integrations/telegram-client.js";
import { PrismaNewsRepository } from "../modules/news/prisma-news.repository.js";
import { PrismaNotificationRepository } from "../modules/notifications/prisma-notifications.repository.js";
import { NotificationsService } from "../modules/notifications/notifications.service.js";
import { WebhookService } from "../modules/notifications/webhook.service.js";
import { createWebPushTransport } from "../modules/notifications/web-push-sender.js";
import { createPersonalServices, type PersonalServices } from "../modules/personal-services.js";
import { PrismaRoutinesRepository } from "../modules/routines/prisma-routines.repository.js";
import { PrismaTimersRepository } from "../modules/timers/prisma-timers.repository.js";
import { PrismaUsersRepository } from "../modules/users/prisma-users.repository.js";
import { UsersService } from "../modules/users/users.service.js";
import { PrismaWidgetsRepository } from "../modules/widgets/prisma-widgets.repository.js";

export type Backend = {
  readonly runtime: ApiRuntime;
  readonly logger: Logger;
  readonly prisma: PrismaClient;
  readonly personal: PersonalServices;
  readonly external: ExternalServices;
  readonly authService: AuthService;
  readonly usersService: UsersService;
  readonly notificationsService: NotificationsService;
  readonly webhookService: WebhookService;
  readonly jobs: JobQueue;
  readonly metrics: MetricsSource;
  readonly renewWatches: () => Promise<void>;
  readonly registerTelegramWebhook: () => Promise<void>;
  readonly close: () => Promise<void>;
};

export async function createBackend(env: NodeJS.ProcessEnv = process.env): Promise<Backend> {
  const runtime = readApiEnv(env);
  const logger = createLogger(runtime.config.logLevel);
  const prisma = getPrismaClient(env);
  await connectDatabase(prisma);
  const cipher = createCredentialCipher(readDataEncryptionKey(env));
  const jobs = new PrismaJobQueue(prisma);
  const users = new PrismaUsersRepository(prisma);
  const audit = new AuditService(new PrismaAuditRepository(prisma));
  const integrationsRepository = new PrismaIntegrationsRepository(prisma);
  const personal = createPersonalServices(
    {
      widgets: new PrismaWidgetsRepository(prisma),
      routines: new PrismaRoutinesRepository(prisma),
      timers: new PrismaTimersRepository(prisma)
    },
    { jobs, maxAttempts: runtime.worker.maxAttempts }
  );
  const gateway = createGoogleCalendarGateway(runtime.googleClientId, runtime.googleClientSecret);
  const telegram = runtime.telegram
    ? new TelegramClient(runtime.telegram.token, runtime.telegram.username, fetch)
    : null;
  const telegramTransport = telegram
    ? {
        send: (chatId: string, text: string) => telegram.sendMessage(chatId, text)
      }
    : null;
  const external = createExternalServices({
    widgets: personal.widgets,
    routines: personal.routines,
    timers: personal.timers,
    users,
    integrations: integrationsRepository,
    news: new PrismaNewsRepository(prisma),
    events: new PrismaCalendarRepository(prisma),
    cipher,
    fetchImpl: fetch,
    oauth: createCalendarOAuthClient({
      clientId: runtime.googleClientId,
      clientSecret: runtime.googleClientSecret,
      redirectUri: runtime.config.googleCalendarRedirectUri
    }),
    gateway,
    weatherApiBaseUrl: runtime.weatherApiBaseUrl,
    telegram: runtime.telegram,
    audit
  });
  const notificationRepository = new PrismaNotificationRepository(prisma, cipher);
  const notificationsService = new NotificationsService(
    notificationRepository,
    users,
    createWebPushTransport(runtime.webPush),
    telegramTransport,
    (userId) => external.integrations.telegramChatId(userId)
  );
  const webhookService = new WebhookService(
    runtime.telegramWebhookSecret,
    runtime.googleCalendarWebhookToken,
    jobs,
    (token, telegramUserId) => external.integrations.completeTelegramLink(token, telegramUserId),
    runtime.worker.maxAttempts,
    () => new Date(),
    telegram
      ? async (chatId, text) => {
          await telegram.sendMessage(chatId, text);
        }
      : null
  );
  const authService = new AuthService(
    new PrismaAuthRepository(prisma),
    createGoogleOAuthClient({
      clientId: runtime.googleClientId,
      clientSecret: runtime.googleClientSecret,
      redirectUri: runtime.config.googleRedirectUri
    }),
    cipher,
    runtime.config.sessionTtlMs,
    runtime.config.oauthStateTtlMs,
    () => new Date(),
    audit
  );
  const usersService = new UsersService(
    users,
    async (userId) => {
      await purgeAccount(prisma, userId);
    },
    () => new Date(),
    audit
  );

  return {
    runtime,
    logger,
    prisma,
    personal,
    external,
    authService,
    usersService,
    notificationsService,
    webhookService,
    jobs,
    metrics: createMetrics(jobs, () => notificationRepository.countDeliveries()),
    renewWatches: () => renewDueWatches(integrationsRepository, gateway, runtime, external),
    registerTelegramWebhook: () =>
      registerTelegramWebhook(
        telegram,
        runtime.telegramWebhookUrl,
        runtime.telegramWebhookSecret,
        logger
      ),
    close: () => disconnectPrisma()
  };
}

async function registerTelegramWebhook(
  telegram: TelegramClient | null,
  webhookUrl: string | null,
  secret: string | null,
  logger: Logger
): Promise<void> {
  if (!telegram || !webhookUrl || !secret) {
    return;
  }

  await telegram.setWebhook(webhookUrl, secret);
  logger.info({ host: new URL(webhookUrl).host }, "Webhook Telegram зарегистрирован");
}

async function renewDueWatches(
  integrations: IntegrationsRepository,
  gateway: CalendarWatchGateway,
  runtime: ApiRuntime,
  external: ExternalServices
): Promise<void> {
  const watches = await integrations.listCalendarWatches(20);
  const targets = await Promise.all(
    watches.map(async (watch) => {
      const state = await external.integrations.calendarState(watch.userId);
      return {
        ...watch,
        credentials:
          state && state.status === "connected" && state.accessToken
            ? {
                accessToken: state.accessToken,
                refreshToken: state.refreshToken,
                expiresAt: state.expiresAt
              }
            : null
      };
    })
  );
  await renewCalendarWatches({
    webhookUrl: runtime.googleCalendarWebhookUrl,
    webhookToken: runtime.googleCalendarWebhookToken,
    now: new Date(),
    targets,
    gateway,
    save: (userId, watch) => integrations.saveCalendarWatch(userId, watch, new Date()),
    markRevoked: (userId) => external.integrations.markCalendarRevoked(userId, new Date())
  });
}
