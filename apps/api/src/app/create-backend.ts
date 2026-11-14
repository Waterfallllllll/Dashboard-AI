import { parseObjectId } from "../shared/object-id.js";
import { readApiEnv, type ApiRuntime } from "../config/env.js";
import { createCredentialCipher, readDataEncryptionKey } from "../infrastructure/crypto/index.js";
import {
  connectDatabase,
  disconnectPrisma,
  getPrismaClient
} from "../infrastructure/db/prisma-client.js";
import type { PrismaClient } from "../generated/prisma/client.js";
import { MongoJobQueue } from "../infrastructure/jobs/mongo-job-queue.js";
import type { Logger } from "../infrastructure/logging/logger.js";
import { createLogger } from "../infrastructure/logging/logger.js";
import { createMetrics, type MetricsSource } from "../infrastructure/metrics/app-metrics.js";
import {
  closeMongo,
  connectMongo,
  purgeAccount,
  readMongoConfig,
  type MongoConfig
} from "../infrastructure/mongodb/index.js";
import { MongoAuthRepository } from "../modules/auth/auth.repository.js";
import { AuthService } from "../modules/auth/auth.service.js";
import { AuditService } from "../modules/audit/audit.service.js";
import { MongoAuditRepository } from "../modules/audit/audit.repository.js";
import { createGoogleOAuthClient } from "../modules/auth/google-oauth.js";
import { MongoCalendarRepository } from "../modules/calendar/calendar.repository.js";
import { renewCalendarWatches } from "../modules/calendar/calendar-watch.js";
import {
  createGoogleCalendarGateway,
  type CalendarWatchGateway
} from "../modules/calendar/google-calendar-gateway.js";
import { createExternalServices, type ExternalServices } from "../modules/external-services.js";
import { createCalendarOAuthClient } from "../modules/integrations/google-calendar-oauth.js";
import { MongoIntegrationsRepository } from "../modules/integrations/integrations.repository.js";
import { TelegramClient } from "../modules/integrations/telegram-client.js";
import { MongoNewsRepository } from "../modules/news/news.repository.js";
import { MongoNotificationRepository } from "../modules/notifications/notifications.repository.js";
import { NotificationsService } from "../modules/notifications/notifications.service.js";
import { WebhookService } from "../modules/notifications/webhook.service.js";
import { createWebPushTransport } from "../modules/notifications/web-push-sender.js";
import { createPersonalServices, type PersonalServices } from "../modules/personal-services.js";
import { MongoRoutinesRepository } from "../modules/routines/routines.repository.js";
import { MongoTimersRepository } from "../modules/timers/timers.repository.js";
import { MongoUsersRepository } from "../modules/users/users.repository.js";
import { UsersService } from "../modules/users/users.service.js";
import { MongoWidgetsRepository } from "../modules/widgets/widgets.repository.js";
import type { MongoClient } from "mongodb";

export type Backend = {
  readonly runtime: ApiRuntime;
  readonly logger: Logger;
  readonly client: MongoClient;
  readonly dbName: string;
  readonly prisma: PrismaClient;
  readonly personal: PersonalServices;
  readonly external: ExternalServices;
  readonly authService: AuthService;
  readonly usersService: UsersService;
  readonly notificationsService: NotificationsService;
  readonly webhookService: WebhookService;
  readonly jobs: MongoJobQueue;
  readonly metrics: MetricsSource;
  readonly renewWatches: () => Promise<void>;
  readonly close: () => Promise<void>;
};

export async function createBackend(env: NodeJS.ProcessEnv = process.env): Promise<Backend> {
  const runtime = readApiEnv(env);
  const logger = createLogger(runtime.config.logLevel);
  const prisma = getPrismaClient(env);
  await connectDatabase(prisma);

  let mongo: MongoConfig;
  let client: MongoClient;

  try {
    mongo = readMongoConfig(env);
    client = await connectMongo(mongo);
  } catch (error) {
    await disconnectPrisma();
    throw error;
  }
  const db = client.db(mongo.dbName);
  const cipher = createCredentialCipher(readDataEncryptionKey(env));
  const jobs = new MongoJobQueue(db);
  const users = new MongoUsersRepository(db);
  const audit = new AuditService(new MongoAuditRepository(db));
  const integrationsRepository = new MongoIntegrationsRepository(db);
  const personal = createPersonalServices(
    {
      widgets: new MongoWidgetsRepository(db),
      routines: new MongoRoutinesRepository(db),
      timers: new MongoTimersRepository(db)
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
    news: new MongoNewsRepository(db),
    events: new MongoCalendarRepository(db),
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
  const notificationRepository = new MongoNotificationRepository(db, cipher);
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
    runtime.worker.maxAttempts
  );
  const authService = new AuthService(
    new MongoAuthRepository(db),
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
      const id = parseObjectId(userId);

      if (!id) {
        throw new Error("Некорректный идентификатор пользователя");
      }

      await purgeAccount(db, id);
    },
    () => new Date(),
    audit
  );

  return {
    runtime,
    logger,
    client,
    dbName: mongo.dbName,
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
    close: async () => {
      try {
        await disconnectPrisma();
      } finally {
        await closeMongo(client);
      }
    }
  };
}

async function renewDueWatches(
  integrations: MongoIntegrationsRepository,
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
