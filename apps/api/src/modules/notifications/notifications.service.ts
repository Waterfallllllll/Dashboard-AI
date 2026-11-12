import type {
  NotificationDelivery,
  NotificationPreferences,
  PushSubscriptionCreate
} from "@dashboard/contracts";
import { API_ERROR_CODES } from "@dashboard/contracts";

import type { ClaimedJob, JobSignal } from "../../infrastructure/jobs/job-types.js";
import { ApiError } from "../../shared/errors/api-error.js";
import type { Actor } from "../auth/auth.types.js";
import { cleanText, deliveryDecision, notificationCopy } from "./notification-policy.js";
import type { NotificationRepository } from "./notifications.repository.js";
import { isPublicPushEndpoint, pushTopic, type PushTransport } from "./web-push-sender.js";

export type NotificationSettingsPort = {
  readNotificationSettings(
    userId: string
  ): Promise<{ preferences: NotificationPreferences; timezone: string } | null>;
  writeNotificationSettings(
    userId: string,
    preferences: NotificationPreferences,
    now: Date
  ): Promise<NotificationPreferences | null>;
};

export type TelegramTransport = {
  send(chatId: string, text: string): Promise<{ messageId: string | null }>;
};

const PERMANENT = Symbol("permanent");

export class NotificationsService {
  constructor(
    private readonly notifications: NotificationRepository,
    private readonly users: NotificationSettingsPort,
    private readonly push: PushTransport,
    private readonly telegram: TelegramTransport | null,
    private readonly telegramChatId: (userId: string) => Promise<string | null>,
    private readonly now: () => Date = () => new Date()
  ) {}

  async preferences(actor: Actor): Promise<NotificationPreferences> {
    const stored = await this.users.readNotificationSettings(actor.userId);

    if (!stored) {
      throw new ApiError({ code: API_ERROR_CODES.notFound });
    }

    return stored.preferences;
  }

  async replacePreferences(
    actor: Actor,
    preferences: NotificationPreferences
  ): Promise<NotificationPreferences> {
    const saved = await this.users.writeNotificationSettings(actor.userId, preferences, this.now());

    if (!saved) {
      throw new ApiError({ code: API_ERROR_CODES.notFound });
    }

    return saved;
  }

  async savePush(actor: Actor, input: PushSubscriptionCreate) {
    if (!isPublicPushEndpoint(input.endpoint)) {
      throw new ApiError({
        code: API_ERROR_CODES.validationFailed,
        fieldErrors: { endpoint: ["Адрес подписки не подходит для Web Push."] }
      });
    }

    const saved = await this.notifications.upsertPush(
      actor.userId,
      input.endpoint,
      input.keys,
      this.now()
    );

    if (!saved) {
      throw new ApiError({ code: API_ERROR_CODES.notFound });
    }

    return { id: saved.id, createdAt: saved.createdAt.toISOString() };
  }

  async revokePush(actor: Actor, id: string): Promise<void> {
    const revoked = await this.notifications.revokePush(actor.userId, id, this.now());

    if (!revoked) {
      throw new ApiError({ code: API_ERROR_CODES.notFound });
    }
  }

  async list(actor: Actor): Promise<readonly NotificationDelivery[]> {
    return this.notifications.listRecent(actor.userId, 20);
  }

  async purgeRevoked(): Promise<void> {
    const cutoff = new Date(this.now().getTime() - 30 * 24 * 60 * 60 * 1000);
    await this.notifications.purgeRevoked(cutoff);
  }

  async deliver(job: ClaimedJob): Promise<JobSignal> {
    const eventType = job.payload.eventType;
    const channel = job.payload.channel;
    const userId = job.userId;

    if (!userId || !eventType || !channel) {
      return { kind: "fail", code: "invalid-payload" };
    }

    const context = await this.users.readNotificationSettings(userId);

    if (!context) {
      return { kind: "done" };
    }

    const decision = deliveryDecision(
      context.preferences,
      eventType,
      channel,
      this.now(),
      context.timezone
    );
    const claim = await this.notifications.claimDelivery({
      userId,
      eventType,
      channel,
      idempotencyKey: job.idempotencyKey,
      now: this.now()
    });

    if (!claim) {
      return { kind: "fail", code: "delivery-owner" };
    }

    if (!claim.proceed) {
      return { kind: "done" };
    }

    if (decision !== "send") {
      await this.notifications.finishDelivery(userId, claim.id, "skipped", null, this.now());
      return { kind: "done" };
    }

    const copy = notificationCopy(eventType, job.payload.title);

    try {
      const providerMessageId = await this.send(userId, channel, copy, job.idempotencyKey);
      await this.notifications.finishDelivery(
        userId,
        claim.id,
        providerMessageId === "skipped" ? "skipped" : "sent",
        providerMessageId === "skipped" ? null : providerMessageId,
        this.now()
      );
      return { kind: "done" };
    } catch (error) {
      if (error === PERMANENT) {
        await this.notifications.finishDelivery(userId, claim.id, "failed", null, this.now());
        return { kind: "fail", code: "delivery-rejected" };
      }

      return { kind: "retry", code: "delivery-transient" };
    }
  }

  private async send(
    userId: string,
    channel: "browser" | "telegram" | "in_app",
    copy: { title: string; body: string; path: "/dashboard"; tag: string },
    idempotencyKey: string
  ): Promise<string | "skipped" | null> {
    if (channel === "in_app") {
      return null;
    }

    if (channel === "telegram") {
      return this.sendTelegram(userId, copy);
    }

    return this.sendPush(userId, copy, idempotencyKey);
  }

  private async sendTelegram(
    userId: string,
    copy: { title: string; body: string }
  ): Promise<string | null | "skipped"> {
    if (!this.telegram) {
      return "skipped";
    }

    const chatId = await this.telegramChatId(userId);

    if (!chatId) {
      return "skipped";
    }

    try {
      const sent = await this.telegram.send(chatId, cleanText(`${copy.title}: ${copy.body}`, 240));
      return sent.messageId;
    } catch (error) {
      if (isPermanent(error)) {
        throw PERMANENT;
      }

      throw error;
    }
  }

  private async sendPush(
    userId: string,
    copy: { title: string; body: string; path: string; tag: string },
    idempotencyKey: string
  ): Promise<string | null | "skipped"> {
    const targets = await this.notifications.activePush(userId);

    if (targets.length === 0) {
      return "skipped";
    }

    const payload = JSON.stringify({
      title: copy.title,
      body: copy.body,
      path: copy.path,
      tag: copy.tag
    });
    let sent = 0;
    let transient = false;

    for (const target of targets) {
      const result = await this.push.send({
        endpoint: target.endpoint,
        p256dh: target.p256dh,
        auth: target.auth,
        payload,
        topic: pushTopic(idempotencyKey)
      });

      if (result === "sent") {
        sent += 1;
        continue;
      }

      if (result === "gone") {
        await this.notifications.revokePush(userId, target.id, this.now());
        continue;
      }

      if (result === "transient") {
        transient = true;
      }
    }

    if (sent > 0 && !transient) {
      return null;
    }

    if (transient) {
      throw new Error("transient");
    }

    return "skipped";
  }
}

function isPermanent(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && "permanent" in error && error.permanent === true
  );
}
