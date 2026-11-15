import { randomUUID } from "node:crypto";

import { afterAll, describe, expect, it } from "vitest";

import { toJobType } from "./enum-map.js";
import { purgeExpiredRows } from "./expired-rows.js";
import { disconnectPrisma, getPrismaClient } from "./prisma-client.js";

const databaseUrl = process.env.DATABASE_URL ?? "";
const hasPostgres =
  databaseUrl.startsWith("postgresql://") || databaseUrl.startsWith("postgres://");
const ciphertext = "enc:v1:AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBB.QQqq";
const past = new Date("2020-01-01T00:00:00.000Z");
const future = new Date("2099-01-01T00:00:00.000Z");

describe.skipIf(!hasPostgres)("удаление просроченных строк в PostgreSQL", () => {
  const userId = randomUUID();
  const newsId = randomUUID();
  const expiredSessionId = randomUUID();
  const liveSessionId = randomUUID();
  const expiredTokenId = randomUUID();
  const liveTokenId = randomUUID();
  const expiredDeliveryId = randomUUID();
  const liveDeliveryId = randomUUID();
  const expiredAuditId = randomUUID();
  const liveAuditId = randomUUID();
  const completedJobId = randomUUID();
  const failedJobId = randomUUID();
  const pendingJobId = randomUUID();
  const processingJobId = randomUUID();
  const futureJobId = randomUUID();
  const heartbeatId = randomUUID();
  const lockId = randomUUID();
  const timerId = randomUUID();

  afterAll(async () => {
    const prisma = getPrismaClient();
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.newsItem.deleteMany({ where: { id: newsId } });
    await prisma.oneTimeToken.deleteMany({
      where: { id: { in: [expiredTokenId, liveTokenId] } }
    });
    await prisma.scheduledJob.deleteMany({
      where: {
        id: {
          in: [
            completedJobId,
            failedJobId,
            pendingJobId,
            processingJobId,
            futureJobId,
            heartbeatId,
            lockId
          ]
        }
      }
    });
    await prisma.auditEvent.deleteMany({ where: { id: { in: [expiredAuditId, liveAuditId] } } });
    await disconnectPrisma();
  });

  it("удаляет только просроченные строки и оставляет историю аккаунта", async () => {
    const prisma = getPrismaClient();
    const stamp = userId.replaceAll("-", "");

    await prisma.user.create({
      data: {
        id: userId,
        displayName: "Проверка срока",
        locale: "ru",
        timezone: "Europe/Moscow"
      }
    });
    await prisma.session.createMany({
      data: [
        {
          id: expiredSessionId,
          userId,
          tokenHash: `${stamp}expired`.padEnd(64, "a"),
          expiresAt: past
        },
        {
          id: liveSessionId,
          userId,
          tokenHash: `${stamp}live`.padEnd(64, "b"),
          expiresAt: future
        }
      ]
    });
    await prisma.oneTimeToken.createMany({
      data: [
        {
          id: expiredTokenId,
          tokenHash: `${stamp}token-expired`.padEnd(64, "c"),
          purpose: "oauth_state",
          payload: ciphertext,
          expiresAt: past
        },
        {
          id: liveTokenId,
          tokenHash: `${stamp}token-live`.padEnd(64, "d"),
          purpose: "telegram_link",
          payload: ciphertext,
          expiresAt: future
        }
      ]
    });
    await prisma.notificationDelivery.createMany({
      data: [
        {
          id: expiredDeliveryId,
          userId,
          eventType: "routine",
          channel: "browser",
          idempotencyKey: `expired-delivery-${stamp}`,
          status: "sent",
          deleteAt: past
        },
        {
          id: liveDeliveryId,
          userId,
          eventType: "work",
          channel: "telegram",
          idempotencyKey: `live-delivery-${stamp}`,
          status: "skipped",
          deleteAt: future
        }
      ]
    });
    await prisma.auditEvent.createMany({
      data: [
        { id: expiredAuditId, userId, action: "logout", deleteAt: past },
        { id: liveAuditId, action: "account_deleted", deleteAt: future }
      ]
    });
    await prisma.timerSession.create({
      data: {
        id: timerId,
        userId,
        mode: "pomodoro",
        workMinutes: 25,
        shortBreakMinutes: 5,
        longBreakMinutes: 15,
        runStatus: "idle",
        phase: "work",
        completedAt: past
      }
    });
    await prisma.newsItem.create({
      data: {
        id: newsId,
        source: "example",
        title: "Новость",
        excerpt: "Коротко",
        canonicalUrl: `https://example.com/${newsId}`,
        contentHash: stamp,
        publishedAt: past,
        language: "ru",
        topics: ["focus"]
      }
    });
    await prisma.scheduledJob.createMany({
      data: [
        job(completedJobId, "completed", past, "refresh-news", `completed-${stamp}`),
        job(failedJobId, "failed", past, "sync-calendar", `failed-${stamp}`),
        job(pendingJobId, "pending", past, "timer-due", `pending-${stamp}`, userId),
        job(processingJobId, "processing", past, "deliver-notification", `processing-${stamp}`),
        job(futureJobId, "completed", future, "scan-due-timers", `future-${stamp}`),
        job(heartbeatId, "completed", null, "worker-heartbeat", `heartbeat-${stamp}`),
        job(lockId, "processing", null, "scheduler-lock", `lock-${stamp}`)
      ]
    });

    const removed = await purgeExpiredRows(prisma, new Date("2026-11-15T12:00:00.000Z"));
    const again = await purgeExpiredRows(prisma, new Date("2026-11-15T12:00:00.000Z"));

    expect(removed.sessions).toBe(1);
    expect(removed.one_time_tokens).toBe(1);
    expect(removed.notification_deliveries).toBe(1);
    expect(removed.audit_events).toBe(1);
    expect(removed.scheduled_jobs).toBe(2);
    expect(again).toEqual({
      sessions: 0,
      one_time_tokens: 0,
      notification_deliveries: 0,
      audit_events: 0,
      scheduled_jobs: 0
    });
    expect(await prisma.session.count({ where: { id: expiredSessionId } })).toBe(0);
    expect(await prisma.session.count({ where: { id: liveSessionId } })).toBe(1);
    expect(await prisma.oneTimeToken.count({ where: { id: expiredTokenId } })).toBe(0);
    expect(await prisma.oneTimeToken.count({ where: { id: liveTokenId } })).toBe(1);
    expect(await prisma.notificationDelivery.count({ where: { id: expiredDeliveryId } })).toBe(0);
    expect(await prisma.notificationDelivery.count({ where: { id: liveDeliveryId } })).toBe(1);
    expect(await prisma.auditEvent.count({ where: { id: expiredAuditId } })).toBe(0);
    expect(await prisma.auditEvent.count({ where: { id: liveAuditId } })).toBe(1);
    expect(await prisma.timerSession.count({ where: { id: timerId } })).toBe(1);
    expect(await prisma.newsItem.count({ where: { id: newsId } })).toBe(1);
    expect(
      await prisma.scheduledJob.count({
        where: { id: { in: [completedJobId, failedJobId] } }
      })
    ).toBe(0);
    expect(
      await prisma.scheduledJob.count({
        where: {
          id: { in: [pendingJobId, processingJobId, futureJobId, heartbeatId, lockId] }
        }
      })
    ).toBe(5);
  });
});

function job(
  id: string,
  status: "completed" | "failed" | "pending" | "processing",
  deleteAt: Date | null,
  type:
    | "refresh-news"
    | "sync-calendar"
    | "timer-due"
    | "deliver-notification"
    | "scan-due-timers"
    | "worker-heartbeat"
    | "scheduler-lock",
  idempotencyKey: string,
  userId: string | null = null
) {
  return {
    id,
    type: toJobType(type),
    payload: {},
    runAt: past,
    status,
    maxAttempts: 1,
    idempotencyKey,
    deleteAt,
    userId
  };
}
