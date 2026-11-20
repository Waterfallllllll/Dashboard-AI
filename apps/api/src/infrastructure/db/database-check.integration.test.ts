import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AccountStillActiveError, purgeAccount } from "./account-purge.js";
import { explainMainQueries } from "./explain-query.js";
import { checkDataIntegrity } from "./integrity.js";
import { connectDatabase, disconnectPrisma, getPrismaClient } from "./prisma-client.js";
import { PLAN_SAMPLE_USER_NAME } from "./routine-plan-sample.js";
import { auditDeleteAt, notificationDeleteAt } from "./retention.js";

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
const apiRoot = fileURLToPath(new URL("../../../", import.meta.url));
const databaseUrl = process.env.DATABASE_URL ?? "";
const hasPostgres =
  databaseUrl.startsWith("postgresql://") || databaseUrl.startsWith("postgres://");
const ciphertext = "enc:v1:AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBB.QQqq";

describe.skipIf(!hasPostgres)("планы запросов, целостность и очистка аккаунта", () => {
  beforeAll(async () => {
    await execFileAsync(
      process.execPath,
      [require.resolve("prisma/build/index.js"), "migrate", "deploy"],
      {
        cwd: apiRoot,
        env: process.env,
        encoding: "utf8",
        timeout: 120_000
      }
    );
    await connectDatabase();
  }, 120_000);

  afterAll(async () => {
    await disconnectPrisma();
  });

  it("читает назначенные индексы и откатывает пробные строки", async () => {
    const prisma = getPrismaClient();
    const before = await prisma.user.count({
      where: { displayName: PLAN_SAMPLE_USER_NAME }
    });
    const results = await explainMainQueries(prisma);
    const after = await prisma.user.count({
      where: { displayName: PLAN_SAMPLE_USER_NAME }
    });
    const failed = results
      .filter((result) => !result.ok)
      .map((result) => `${result.name}: ${result.reason}`);

    expect(after).toBe(before);
    expect(failed).toEqual([]);
  }, 120_000);

  it("находит чужой срок журнала и анонимное событие, которое не является очисткой", async () => {
    const prisma = getPrismaClient();
    const userId = randomUUID();
    const createdAt = new Date("2026-11-01T00:00:00.000Z");
    const badDeliveryId = randomUUID();
    const goodDeliveryId = randomUUID();
    const anonymousId = randomUUID();

    try {
      await prisma.user.create({
        data: {
          id: userId,
          displayName: "Проверка целостности",
          locale: "ru",
          timezone: "Europe/Moscow"
        }
      });
      await prisma.notificationDelivery.create({
        data: {
          id: badDeliveryId,
          userId,
          eventType: "routine",
          channel: "browser",
          idempotencyKey: `bad-${badDeliveryId}`,
          status: "sent",
          createdAt,
          deleteAt: createdAt
        }
      });
      await prisma.notificationDelivery.create({
        data: {
          id: goodDeliveryId,
          userId,
          eventType: "routine",
          channel: "browser",
          idempotencyKey: `good-${goodDeliveryId}`,
          status: "sent",
          createdAt,
          deleteAt: notificationDeleteAt(createdAt)
        }
      });
      await prisma.auditEvent.create({
        data: {
          id: anonymousId,
          action: "login",
          createdAt,
          deleteAt: auditDeleteAt(createdAt)
        }
      });

      const report = await checkDataIntegrity(prisma);
      const ids = new Map(
        report.violations.map((violation) => [violation.documentId, violation.code])
      );

      expect(ids.get(badDeliveryId)).toBe("DELIVERY_EXPIRY_OUT_OF_POLICY");
      expect(ids.get(goodDeliveryId)).toBeUndefined();
      expect(ids.get(anonymousId)).toBe("AUDIT_ANONYMOUS_ACTION");
    } finally {
      await prisma.user.deleteMany({ where: { id: userId } });
      await prisma.auditEvent.deleteMany({ where: { id: anonymousId } });
    }
  });

  it("физически удаляет только мягко удалённый аккаунт и сохраняет общий кэш", async () => {
    const prisma = getPrismaClient();
    const userId = randomUUID();
    const liveId = randomUUID();
    const newsId = randomUUID();
    const tokenId = randomUUID();
    const systemJobId = randomUUID();
    const startedAt = new Date();
    let tombstoneId: string | undefined;

    try {
      await prisma.user.create({
        data: {
          id: liveId,
          displayName: "Живой аккаунт",
          locale: "ru",
          timezone: "Europe/Moscow"
        }
      });
      await insertOwnedGraph(userId, newsId, tokenId, systemJobId);
      await prisma.user.update({
        where: { id: userId },
        data: { deletedAt: new Date() }
      });

      await expect(purgeAccount(prisma, liveId)).rejects.toBeInstanceOf(AccountStillActiveError);
      expect(await prisma.user.count({ where: { id: liveId } })).toBe(1);

      const purged = await purgeAccount(prisma, userId);

      expect(purged.user).toBe("purged");
      expect(purged.deleted.users).toBe(1);
      expect(purged.deleted.sessions).toBe(1);
      expect(purged.deleted.routine_occurrences).toBe(1);
      expect(purged.deleted.calendar_events).toBe(1);
      expect(purged.deleted.scheduled_jobs).toBe(1);
      expect(await prisma.user.count({ where: { id: userId } })).toBe(0);
      expect(await prisma.session.count({ where: { userId } })).toBe(0);
      expect(await prisma.routineOccurrence.count({ where: { userId } })).toBe(0);
      expect(await prisma.calendarEvent.count({ where: { userId } })).toBe(0);
      expect(await prisma.newsItem.count({ where: { id: newsId } })).toBe(1);
      expect(await prisma.oneTimeToken.count({ where: { id: tokenId } })).toBe(1);
      expect(await prisma.scheduledJob.count({ where: { id: systemJobId } })).toBe(1);

      const tombstones = await prisma.auditEvent.findMany({
        where: {
          action: "account_deleted",
          userId: null,
          createdAt: { gte: startedAt }
        },
        select: { id: true, createdAt: true, deleteAt: true }
      });
      const tombstone = tombstones.find(
        (event) => event.deleteAt.getTime() === auditDeleteAt(event.createdAt).getTime()
      );

      if (!tombstone) {
        throw new Error("Нет записи account_deleted");
      }

      tombstoneId = tombstone.id;
      expect(tombstone.deleteAt.toISOString()).toBe(
        auditDeleteAt(tombstone.createdAt).toISOString()
      );

      const repeated = await purgeAccount(prisma, userId);

      expect(repeated.user).toBe("missing");
      expect(repeated.deleted.users).toBe(0);
      expect(await prisma.newsItem.count({ where: { id: newsId } })).toBe(1);
      expect(await prisma.auditEvent.count({ where: { id: tombstone.id } })).toBe(1);
    } finally {
      await prisma.user.deleteMany({ where: { id: { in: [userId, liveId] } } });
      await prisma.newsItem.deleteMany({ where: { id: newsId } });
      await prisma.oneTimeToken.deleteMany({ where: { id: tokenId } });
      await prisma.scheduledJob.deleteMany({ where: { id: systemJobId } });
      if (tombstoneId) {
        await prisma.auditEvent.deleteMany({ where: { id: tombstoneId } });
      }
    }
  });
});

async function insertOwnedGraph(
  userId: string,
  newsId: string,
  tokenId: string,
  systemJobId: string
): Promise<void> {
  const prisma = getPrismaClient();
  const ruleId = randomUUID();
  const integrationId = randomUUID();
  const now = new Date("2026-11-01T00:00:00.000Z");

  await prisma.user.create({
    data: {
      id: userId,
      displayName: "Мягко удалённый аккаунт",
      locale: "ru",
      timezone: "Europe/Moscow"
    }
  });
  await prisma.authAccount.create({
    data: {
      userId,
      provider: "google",
      providerUserId: `purge-${userId}`,
      scope: [],
      accessToken: ciphertext
    }
  });
  await prisma.session.create({
    data: {
      userId,
      tokenHash: userId.replaceAll("-", ""),
      expiresAt: new Date("2026-12-01T00:00:00.000Z")
    }
  });
  await prisma.widgetPreference.create({
    data: {
      userId,
      widgetType: "news",
      enabled: true,
      position: 0,
      size: "standard",
      settings: { limit: 5 }
    }
  });
  await prisma.routineRule.create({
    data: {
      id: ruleId,
      userId,
      title: "Вода",
      startDate: now,
      recurrenceKind: "daily",
      recurrenceDays: [],
      timezone: "Europe/Moscow",
      status: "active"
    }
  });
  await prisma.routineOccurrence.create({
    data: {
      routineRuleId: ruleId,
      userId,
      localDate: now,
      status: "pending"
    }
  });
  await prisma.timerPreset.create({
    data: {
      userId,
      mode: "pomodoro",
      workMinutes: 25,
      shortBreakMinutes: 5,
      longBreakMinutes: 15
    }
  });
  await prisma.timerSession.create({
    data: {
      userId,
      mode: "pomodoro",
      workMinutes: 25,
      shortBreakMinutes: 5,
      longBreakMinutes: 15,
      runStatus: "idle",
      phase: "work",
      completedAt: now
    }
  });
  await prisma.integration.create({
    data: {
      id: integrationId,
      userId,
      type: "telegram",
      status: "connected"
    }
  });
  await prisma.calendarEvent.create({
    data: {
      integrationId,
      userId,
      externalEventId: `event-${userId}`,
      calendarName: "Основной",
      title: "Встреча",
      startAt: now,
      endAt: new Date("2026-11-01T01:00:00.000Z"),
      allDay: false,
      htmlLink: "https://calendar.example/event",
      status: "confirmed"
    }
  });
  await prisma.pushSubscription.create({
    data: {
      userId,
      endpointHash: userId.replaceAll("-", ""),
      endpoint: `https://push.example/${userId}`,
      keys: ciphertext
    }
  });
  await prisma.notificationDelivery.create({
    data: {
      userId,
      eventType: "routine",
      channel: "browser",
      idempotencyKey: `purge-${userId}`,
      status: "sent",
      createdAt: now,
      deleteAt: notificationDeleteAt(now)
    }
  });
  await prisma.auditEvent.create({
    data: {
      userId,
      action: "login",
      createdAt: now,
      deleteAt: auditDeleteAt(now)
    }
  });
  await prisma.newsItem.create({
    data: {
      id: newsId,
      source: "example",
      title: "Новость",
      excerpt: "Коротко",
      canonicalUrl: `https://example.com/${newsId}`,
      contentHash: newsId.replaceAll("-", ""),
      publishedAt: now,
      language: "ru",
      topics: ["focus"]
    }
  });
  await prisma.oneTimeToken.create({
    data: {
      id: tokenId,
      tokenHash: `${tokenId.replaceAll("-", "")}${tokenId.replaceAll("-", "")}`,
      purpose: "oauth_state",
      payload: ciphertext,
      expiresAt: new Date("2026-11-01T00:10:00.000Z")
    }
  });
  await insertJob(systemJobId, `lock-${systemJobId}`, null);
  await insertJob(randomUUID(), `user-${userId}`, userId);
}

async function insertJob(id: string, key: string, userId: string | null): Promise<void> {
  const type = userId === null ? "scheduler-lock" : "timer-due";
  const prisma = getPrismaClient();

  if (userId === null) {
    await prisma.$executeRaw`
      INSERT INTO "scheduled_jobs" (
        "id", "type", "payload", "run_at", "max_attempts", "idempotency_key", "updated_at"
      )
      VALUES (
        ${id}::uuid,
        ${type}::"scheduled_job_type",
        '{}'::jsonb,
        NOW(),
        1,
        ${key},
        NOW()
      )
    `;
    return;
  }

  await prisma.$executeRaw`
    INSERT INTO "scheduled_jobs" (
      "id", "type", "payload", "run_at", "max_attempts", "idempotency_key", "user_id", "updated_at"
    )
    VALUES (
      ${id}::uuid,
      ${type}::"scheduled_job_type",
      '{}'::jsonb,
      NOW(),
      1,
      ${key},
      ${userId}::uuid,
      NOW()
    )
  `;
}
