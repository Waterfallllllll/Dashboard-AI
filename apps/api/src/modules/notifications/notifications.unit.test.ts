import { DEFAULT_NOTIFICATION_PREFERENCES } from "@dashboard/contracts";
import { describe, expect, it } from "vitest";

import { MemoryJobQueue } from "../../infrastructure/jobs/memory-job-queue.js";
import type { ClaimedJob } from "../../infrastructure/jobs/job-types.js";
import { MemoryNotificationRepository } from "./notifications.repository.js";
import { NotificationsService, type NotificationSettingsPort } from "./notifications.service.js";
import { isPublicPushEndpoint } from "./web-push-sender.js";
import { WebhookService } from "./webhook.service.js";

const userId = "a".repeat(24);
const now = new Date("2026-11-12T10:00:00.000Z");

function users(): NotificationSettingsPort {
  return {
    readNotificationSettings: async () => ({
      preferences: DEFAULT_NOTIFICATION_PREFERENCES,
      timezone: "Europe/Moscow"
    }),
    writeNotificationSettings: async (userId, preferences) =>
      userId.length === 24 ? preferences : null
  };
}

function claimed(channel: "browser" | "telegram" | "in_app"): ClaimedJob {
  return {
    id: "job-1",
    type: "deliver-notification",
    payload: { eventType: "work", channel, title: "Таймер" },
    idempotencyKey: `timer:${userId}:work:completed:${channel}`,
    userId,
    attempts: 1,
    maxAttempts: 5,
    runAt: now
  };
}

describe("доставка уведомлений", () => {
  it("второй вызов с тем же ключом не обращается к каналу", async () => {
    const repository = new MemoryNotificationRepository();
    let sends = 0;
    const service = new NotificationsService(
      repository,
      users(),
      {
        send: async () => {
          sends += 1;
          return "sent";
        }
      },
      null,
      async () => null,
      () => now
    );
    await service.deliver(claimed("in_app"));
    await service.deliver(claimed("in_app"));
    expect(sends).toBe(0);
    const items = await repository.listRecent(userId, 20);
    expect(items).toHaveLength(1);
    expect(items[0]?.status).toBe("sent");
  });

  it("тихие часы записывают пропуск", async () => {
    const repository = new MemoryNotificationRepository();
    const quietUsers: NotificationSettingsPort = {
      readNotificationSettings: async () => ({
        preferences: {
          ...DEFAULT_NOTIFICATION_PREFERENCES,
          quietStart: "09:00",
          quietEnd: "18:00"
        },
        timezone: "Europe/Moscow"
      }),
      writeNotificationSettings: async (userId, preferences) =>
        userId.length === 24 ? preferences : null
    };
    const service = new NotificationsService(
      repository,
      quietUsers,
      { send: async () => "sent" },
      null,
      async () => null,
      () => now
    );
    const result = await service.deliver(claimed("browser"));
    expect(result).toEqual({ kind: "done" });
    expect((await repository.listRecent(userId, 20))[0]?.status).toBe("skipped");
  });

  it("отклоняет приватный endpoint подписки", () => {
    expect(isPublicPushEndpoint("https://127.0.0.1/push")).toBe(false);
    expect(isPublicPushEndpoint("https://updates.example.com/push")).toBe(true);
  });
});

describe("webhook", () => {
  it("не принимает Telegram без секрета и ставит синхронизацию календаря в очередь", async () => {
    const jobs = new MemoryJobQueue();
    let links = 0;
    const webhooks = new WebhookService(
      "telegram-secret-value",
      "google-calendar-token",
      jobs,
      async () => {
        links += 1;
        return "linked";
      },
      5,
      () => now
    );

    await expect(
      webhooks.acceptTelegram({
        secret: "wrong-secret-value",
        text: "/start abcdefghijklmnopqrst",
        telegramUserId: "1"
      })
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    expect(links).toBe(0);
    await webhooks.acceptTelegram({
      secret: "telegram-secret-value",
      text: "/start abcdefghijklmnopqrst",
      telegramUserId: "42"
    });
    expect(links).toBe(1);
    await webhooks.acceptGoogleCalendar({
      token: "google-calendar-token",
      channelId: "channel-1",
      resourceState: "sync"
    });
    expect((await jobs.counts()).pending).toBe(0);
    await webhooks.acceptGoogleCalendar({
      token: "google-calendar-token",
      channelId: "channel-1",
      resourceState: "exists"
    });
    expect((await jobs.counts()).pending).toBe(1);
  });
});
