import { createHash } from "node:crypto";

import { TIMER_ALREADY_RUNNING } from "@dashboard/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { GOOGLE_CALENDAR_SCOPE, OAUTH_STATE_TTL_MS, SESSION_TTL_MS } from "../config/constants.js";
import {
  CREDENTIAL_PURPOSES,
  createCredentialCipher,
  readDataEncryptionKey
} from "../infrastructure/crypto/credential-cipher.js";
import { disconnectPrisma, getPrismaClient } from "../infrastructure/db/prisma-client.js";
import type { PrismaClient } from "../generated/prisma/client.js";
import { PrismaJobQueue } from "../infrastructure/jobs/prisma-job-queue.js";
import type { ClaimedJob } from "../infrastructure/jobs/job-types.js";
import { CalendarSyncResetError } from "./calendar/calendar-model.js";
import type { CalendarGateway } from "./calendar/google-calendar-gateway.js";
import { PrismaCalendarRepository } from "./calendar/prisma-calendar.repository.js";
import { AuditService } from "./audit/audit.service.js";
import { PrismaAuditRepository } from "./audit/prisma-audit.repository.js";
import { AuthService } from "./auth/auth.service.js";
import { OAuthCallbackError } from "./auth/auth.types.js";
import type { Actor } from "./auth/auth.types.js";
import { PrismaAuthRepository } from "./auth/prisma-auth.repository.js";
import type { GoogleOAuthClient } from "./auth/google-oauth.js";
import type { GoogleTokenSet } from "./auth/google-identity.js";
import { hashToken } from "./auth/token-hash.js";
import { createExternalServices } from "./external-services.js";
import type { CalendarOAuthClient } from "./integrations/google-calendar-oauth.js";
import { PrismaIntegrationsRepository } from "./integrations/prisma-integrations.repository.js";
import { PrismaNewsRepository } from "./news/prisma-news.repository.js";
import { PrismaNotificationRepository } from "./notifications/prisma-notifications.repository.js";
import { NotificationsService } from "./notifications/notifications.service.js";
import type { PushTransport } from "./notifications/web-push-sender.js";
import { WebhookService } from "./notifications/webhook.service.js";
import { createPersonalServices } from "./personal-services.js";
import { PrismaRoutinesRepository } from "./routines/prisma-routines.repository.js";
import { PrismaTimersRepository } from "./timers/prisma-timers.repository.js";
import { PrismaUsersRepository } from "./users/prisma-users.repository.js";
import type { UserProfile } from "./users/user-profile.js";
import { PrismaWidgetsRepository } from "./widgets/prisma-widgets.repository.js";

const databaseUrl = process.env.DATABASE_URL ?? "";
const hasPostgres =
  databaseUrl.startsWith("postgresql://") || databaseUrl.startsWith("postgres://");
const now = new Date("2026-11-15T09:00:00.000Z");
const localDate = "2026-11-15";
const encryptionKey = Buffer.alloc(32, 8).toString("base64url");
const refreshSecret = "1//user-refresh-secret";
const calendarAccess = "ya29.calendar-access-secret";
const calendarRefresh = "1//calendar-refresh-secret";
const refreshedAccess = "ya29.refreshed-access-secret";
const googleWebhookToken = "a".repeat(32);
const channelId = "business-flow-channel";
const claimInstant = new Date("1970-01-02T00:00:00.000Z");

describe.skipIf(!hasPostgres)("бизнес-логика на PostgreSQL", () => {
  const cipher = createCredentialCipher(
    readDataEncryptionKey({ DATA_ENCRYPTION_KEY: encryptionKey })
  );
  const google = new ScriptedGoogle();
  const calendarOauth = new ScriptedCalendarOAuth();
  const syncTokens: Array<string | null> = [];
  const gateway: CalendarGateway = {
    async listEvents(_credentials, query) {
      syncTokens.push(query.syncToken);

      if (query.syncToken) {
        throw new CalendarSyncResetError();
      }

      return {
        events: [
          {
            id: "evt-business",
            status: "confirmed",
            summary: "План",
            htmlLink: "https://calendar.google.com/calendar/event?eid=evt",
            location: "",
            hangoutLink: "",
            meetingUrl: "",
            startDate: "",
            startDateTime: "2026-11-15T15:00:00+03:00",
            endDate: "",
            endDateTime: "2026-11-15T16:00:00+03:00"
          }
        ],
        nextPageToken: null,
        nextSyncToken: null,
        accessToken: refreshedAccess
      };
    }
  };
  const userIds: string[] = [];
  const tokenHashes: string[] = [];
  const jobKeys: string[] = [];
  let prisma: PrismaClient;
  let auth: AuthService;
  let personal: ReturnType<typeof createPersonalServices>;
  let external: ReturnType<typeof createExternalServices>;
  let notifications: NotificationsService;
  let webhooks: WebhookService;
  let jobs: PrismaJobQueue;
  let pushSends = 0;
  let owner: UserProfile;
  let other: UserProfile;

  beforeAll(async () => {
    prisma = getPrismaClient();
    const users = new PrismaUsersRepository(prisma);
    const audit = new AuditService(new PrismaAuditRepository(prisma), () => now);
    jobs = new PrismaJobQueue(prisma);
    personal = createPersonalServices(
      {
        widgets: new PrismaWidgetsRepository(prisma),
        routines: new PrismaRoutinesRepository(prisma),
        timers: new PrismaTimersRepository(prisma)
      },
      { now: () => now, jobs, maxAttempts: 3 }
    );
    external = createExternalServices({
      widgets: personal.widgets,
      routines: personal.routines,
      timers: personal.timers,
      users,
      integrations: new PrismaIntegrationsRepository(prisma),
      news: new PrismaNewsRepository(prisma),
      events: new PrismaCalendarRepository(prisma),
      cipher,
      fetchImpl: async () => {
        throw new Error("Внешний сервис не отвечает");
      },
      oauth: calendarOauth,
      gateway,
      weatherApiBaseUrl: "https://api.open-meteo.com",
      telegram: null,
      now: () => now,
      audit
    });
    const push: PushTransport = {
      async send() {
        pushSends += 1;
        return "sent";
      }
    };
    notifications = new NotificationsService(
      new PrismaNotificationRepository(prisma, cipher),
      users,
      push,
      null,
      async () => null,
      () => now
    );
    webhooks = new WebhookService(
      "b".repeat(32),
      googleWebhookToken,
      jobs,
      async () => "invalid",
      3,
      () => now
    );
    auth = new AuthService(
      new PrismaAuthRepository(prisma),
      google,
      cipher,
      SESSION_TTL_MS,
      OAUTH_STATE_TTL_MS,
      () => now,
      audit
    );
    owner = await login("code-owner", "owner-subject", "Владелец");
    other = await login("code-other", "other-subject", "Сосед");
  }, 30_000);

  afterAll(async () => {
    if (!hasPostgres) {
      return;
    }

    const client = getPrismaClient();
    if (userIds.length > 0) {
      await client.user.deleteMany({ where: { id: { in: userIds } } });
    }

    if (tokenHashes.length > 0) {
      await client.oneTimeToken.deleteMany({ where: { tokenHash: { in: tokenHashes } } });
    }

    await client.scheduledJob.deleteMany({
      where: {
        OR: [
          ...(jobKeys.length > 0 ? [{ idempotencyKey: { in: jobKeys } }] : []),
          { idempotencyKey: { startsWith: `calendar-webhook:${channelKey(channelId)}` } }
        ]
      }
    });
    await disconnectPrisma();
  });

  it("хранит сессию хешем, а refresh token только ciphertext", async () => {
    const account = await prisma.authAccount.findFirst({
      where: { userId: owner.id, provider: "google" }
    });
    const sessions = await prisma.session.findMany({ where: { userId: owner.id } });
    const stored = JSON.stringify({ account, sessions });

    expect(account?.refreshToken?.startsWith("enc:v1:")).toBe(true);
    expect(cipher.decrypt(account?.refreshToken ?? "", CREDENTIAL_PURPOSES.refreshToken)).toBe(
      refreshSecret
    );
    expect(stored).not.toContain(refreshSecret);
    expect(stored).not.toContain(ownerSessionToken);
    expect(sessions.some((session) => session.tokenHash === hashToken(ownerSessionToken))).toBe(
      true
    );

    await expect(auth.completeLogin(ownerCallback)).rejects.toBeInstanceOf(OAuthCallbackError);
    const active = await auth.authenticate(ownerSessionToken);
    expect(active?.user.id).toBe(owner.id);
    await auth.revoke(active?.actor.sessionId ?? "", owner.id);
    expect(await auth.authenticate(ownerSessionToken)).toBeNull();
    const audit = await prisma.auditEvent.findMany({
      where: { userId: owner.id },
      select: { action: true, target: true }
    });
    expect(audit).toEqual(
      expect.arrayContaining([
        { action: "login", target: "google" },
        { action: "logout", target: null }
      ])
    );
  });

  it("создаёт экземпляр рутины на дату и не отдаёт его другому пользователю", async () => {
    const created = await personal.routines.create(
      actor(owner),
      { title: "Вода", startDate: localDate, recurrence: { kind: "daily" } },
      owner.timezone,
      null
    );
    const day = await personal.routines.listDay(actor(owner), localDate, localDate);
    const item = day.items.find((entry) => entry.ruleId === created.rule.id);
    const done = item
      ? await personal.routines.updateOccurrence(actor(owner), item.id, { status: "done" })
      : null;
    const foreign = await personal.routines.listDay(actor(other), localDate, localDate);

    expect(item?.status).toBe("pending");
    expect(done?.status).toBe("done");
    expect(done?.completedAt).not.toBeNull();
    expect(foreign.items.some((entry) => entry.id === item?.id)).toBe(false);
    await expect(
      personal.routines.updateOccurrence(actor(other), item?.id ?? owner.id, { status: "done" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("держит одну активную сессию таймера и сохраняет endsAt", async () => {
    const started = await personal.timers.start(
      actor(owner),
      {
        preset: {
          mode: "pomodoro",
          workMinutes: 25,
          shortBreakMinutes: 5,
          longBreakMinutes: 15
        }
      },
      localDate,
      owner.timezone,
      null
    );
    const session = started.snapshot.session;

    expect(session?.endsAt).toBe(new Date(now.getTime() + 25 * 60_000).toISOString());
    await expect(
      personal.timers.start(
        actor(owner),
        {
          preset: {
            mode: "pomodoro",
            workMinutes: 25,
            shortBreakMinutes: 5,
            longBreakMinutes: 15
          }
        },
        localDate,
        owner.timezone,
        null
      )
    ).rejects.toMatchObject({ code: TIMER_ALREADY_RUNNING });

    const paused = await personal.timers.update(
      actor(owner),
      session?.id ?? "",
      { action: "pause", version: session?.version ?? 0 },
      localDate,
      owner.timezone
    );
    const row = await prisma.timerSession.findFirst({
      where: { id: session?.id ?? "" }
    });

    expect(paused.session?.runStatus).toBe("paused");
    expect(row?.endsAt).not.toBeNull();
    expect(row?.runStatus).toBe("paused");
  });

  it("повторная доставка уведомления не вызывает канал", async () => {
    const endpoint = "https://updates.example.com/push/business-flow";
    await notifications.savePush(actor(owner), {
      endpoint,
      keys: { p256dh: "c".repeat(32), auth: "d".repeat(16) }
    });
    const job: ClaimedJob = {
      id: "00000000-0000-4000-8000-000000000001",
      type: "deliver-notification",
      payload: { eventType: "work", channel: "browser", title: "Таймер" },
      idempotencyKey: `notify:work:browser:${owner.id}`,
      userId: owner.id,
      attempts: 1,
      maxAttempts: 3,
      runAt: now
    };

    expect(await notifications.deliver(job)).toEqual({ kind: "done" });
    expect(await notifications.deliver(job)).toEqual({ kind: "done" });
    expect(pushSends).toBe(1);
    const subscription = await prisma.pushSubscription.findFirst({
      where: { userId: owner.id }
    });
    expect(subscription?.keys.startsWith("enc:v1:")).toBe(true);
    expect(subscription?.keys).not.toContain("c".repeat(32));
  });

  it("после 410 сбрасывает курсор и сохраняет обновлённый токен шифром", async () => {
    const link = await external.integrations.beginGoogle(actor(owner));
    tokenHashes.push(hashToken(new URL(link.url).searchParams.get("state") ?? ""));
    await external.integrations.completeGoogle(
      actor(owner),
      new URLSearchParams({
        code: "calendar-code",
        state: new URL(link.url).searchParams.get("state") ?? ""
      })
    );
    await external.integrations.saveCalendarSync(owner.id, "expired-cursor", null, now);
    const section = await external.calendar.sync(viewer(owner), localDate);
    const integration = await prisma.integration.findFirst({
      where: { userId: owner.id, type: "google_calendar", deletedAt: null }
    });
    const credentials = JSON.parse(
      cipher.decrypt(integration?.credentials ?? "", CREDENTIAL_PURPOSES.integrationCredentials)
    ) as { accessToken?: string };
    const foreign = await external.calendar.load(viewer(other), localDate);

    expect(syncTokens).toEqual(["expired-cursor", null]);
    expect(integration?.syncCursor).toBeNull();
    expect(credentials.accessToken).toBe(refreshedAccess);
    expect(integration?.credentials).not.toContain(refreshedAccess);
    expect(integration?.credentials).not.toContain(calendarRefresh);
    expect(section.status).toBe("ready");
    expect(foreign.status).toBe("unavailable");
  });

  it("очередь захватывает свои задачи и webhook идемпотентен", async () => {
    const firstKey = `queue:claim:first:${owner.id}`;
    const secondKey = `queue:claim:second:${owner.id}`;
    jobKeys.push(firstKey, secondKey);
    expect(
      await jobs.schedule({
        type: "refresh-news",
        payload: {},
        runAt: new Date("1970-01-01T00:00:00.000Z"),
        idempotencyKey: firstKey,
        userId: null,
        maxAttempts: 3
      })
    ).toBe("created");
    expect(
      await jobs.schedule({
        type: "refresh-news",
        payload: {},
        runAt: new Date("1970-01-01T00:00:01.000Z"),
        idempotencyKey: secondKey,
        userId: null,
        maxAttempts: 3
      })
    ).toBe("created");

    const first = await jobs.claim("worker-a", claimInstant, 60_000);
    const second = await jobs.claim("worker-b", claimInstant, 60_000);
    const third = await jobs.claim("worker-c", claimInstant, 60_000);
    expect(first?.idempotencyKey).toBe(firstKey);
    expect(second?.idempotencyKey).toBe(secondKey);
    expect(third).toBeNull();
    const retainUntil = new Date("2099-01-01T00:00:00.000Z");
    expect(await jobs.complete(first?.id ?? "", "worker-a", claimInstant, retainUntil)).toBe(true);
    expect(await jobs.complete(second?.id ?? "", "worker-b", claimInstant, retainUntil)).toBe(true);
    expect(
      await jobs.schedule({
        type: "refresh-news",
        payload: {},
        runAt: claimInstant,
        idempotencyKey: firstKey,
        userId: null,
        maxAttempts: 3
      })
    ).toBe("exists");
    expect(await prisma.scheduledJob.count({ where: { idempotencyKey: firstKey } })).toBe(1);

    await expect(
      webhooks.acceptGoogleCalendar({
        token: "b".repeat(32),
        channelId,
        resourceState: "exists"
      })
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    await webhooks.acceptGoogleCalendar({
      token: googleWebhookToken,
      channelId,
      resourceState: "exists"
    });
    await webhooks.acceptGoogleCalendar({
      token: googleWebhookToken,
      channelId,
      resourceState: "exists"
    });
    expect(
      await prisma.scheduledJob.count({
        where: { idempotencyKey: { startsWith: `calendar-webhook:${channelKey(channelId)}` } }
      })
    ).toBe(1);
  });

  it("сбой погоды и новостей не ломает остальные секции дашборда", async () => {
    await personal.routines.create(
      actor(owner),
      { title: "Зарядка", startDate: localDate, recurrence: { kind: "daily" } },
      owner.timezone,
      null
    );
    await prisma.user.update({
      where: { id: owner.id },
      data: { weatherLatitude: 55.75, weatherLongitude: 37.62, weatherLabel: "Москва" }
    });
    const dashboard = await external.dashboard.load(viewer(owner), localDate);

    expect(dashboard.datetime.status).toBe("ready");
    expect(dashboard.routines.status).toBe("ready");
    expect(dashboard.weather.status).toBe("error");
    expect(dashboard.news.status).toBe("error");
  });

  let ownerSessionToken = "";
  let ownerCallback = new URLSearchParams();

  async function login(code: string, subject: string, name: string): Promise<UserProfile> {
    google.identities.set(code, identity(subject, name));
    const url = await auth.beginLogin();
    const state = new URL(url).searchParams.get("state") ?? "";
    tokenHashes.push(hashToken(state));
    const query = new URLSearchParams({ code, state });
    const session = await auth.completeLogin(query);

    if (code === "code-owner") {
      ownerSessionToken = session.token;
      ownerCallback = query;
    }

    userIds.push(session.user.id);
    return session.user;
  }
});

function actor(user: UserProfile): Actor {
  return { userId: user.id, sessionId: "session-test" };
}

function viewer(user: UserProfile) {
  return {
    userId: user.id,
    sessionId: "session-test",
    timezone: user.timezone,
    timeFormat: user.timeFormat
  };
}

function channelKey(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

function identity(subject: string, name: string): GoogleTokenSet {
  return {
    subject,
    emailVerified: true,
    name,
    picture: null,
    locale: "ru",
    accessToken: `ya29.${subject}-access`,
    refreshToken: refreshSecret,
    expiresIn: 3600,
    scope: "openid email profile"
  };
}

class ScriptedGoogle implements GoogleOAuthClient {
  private sequence = 0;
  readonly identities = new Map<string, GoogleTokenSet>();

  async createAuthorizationRequest() {
    this.sequence += 1;
    const suffix = String(this.sequence).padStart(2, "0");
    const state = `state${suffix}${"e".repeat(40)}`;
    return {
      url: `https://accounts.google.com/o/oauth2/v2/auth?state=${state}`,
      state,
      nonce: `nonce${suffix}${"f".repeat(40)}`,
      codeVerifier: `verifier${suffix}${"g".repeat(40)}`
    };
  }

  async exchangeAuthorizationCode(query: URLSearchParams): Promise<GoogleTokenSet> {
    const tokenSet = this.identities.get(query.get("code") ?? "");

    if (!tokenSet) {
      throw new Error("unknown code");
    }

    return tokenSet;
  }
}

class ScriptedCalendarOAuth implements CalendarOAuthClient {
  private state = `calstate${"h".repeat(24)}`;

  async createAuthorizationRequest() {
    return {
      url: `https://accounts.google.com/o/oauth2/v2/auth?state=${this.state}`,
      state: this.state,
      codeVerifier: `calverifier${"i".repeat(32)}`
    };
  }

  async exchangeAuthorizationCode() {
    return {
      accessToken: calendarAccess,
      refreshToken: calendarRefresh,
      expiresIn: 3600,
      scope: GOOGLE_CALENDAR_SCOPE
    };
  }
}
