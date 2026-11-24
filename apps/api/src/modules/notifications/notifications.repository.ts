import type {
  NotificationChannel,
  NotificationDelivery,
  NotificationEvent,
  NotificationStatus
} from "@dashboard/contracts";

import { newEntityId } from "../../shared/public-id.js";

export type PushKeys = { readonly p256dh: string; readonly auth: string };

export type PushTarget = PushKeys & { readonly id: string; readonly endpoint: string };

export type DeliveryDraft = {
  readonly userId: string;
  readonly eventType: NotificationEvent;
  readonly channel: NotificationChannel;
  readonly idempotencyKey: string;
  readonly now: Date;
};

export type DeliveryClaim = {
  readonly id: string;
  readonly status: NotificationStatus;
  readonly proceed: boolean;
};

export type NotificationRepository = {
  upsertPush(
    userId: string,
    endpoint: string,
    keys: PushKeys,
    now: Date
  ): Promise<{ id: string; createdAt: Date } | null>;
  revokePush(userId: string, id: string, now: Date): Promise<boolean>;
  activePush(userId: string): Promise<readonly PushTarget[]>;
  purgeRevoked(before: Date): Promise<number>;
  claimDelivery(draft: DeliveryDraft): Promise<DeliveryClaim | null>;
  finishDelivery(
    userId: string,
    id: string,
    status: NotificationStatus,
    providerMessageId: string | null,
    now: Date
  ): Promise<void>;
  listRecent(userId: string, limit: number): Promise<readonly NotificationDelivery[]>;
  countDeliveries(): Promise<readonly { channel: string; status: string; count: number }[]>;
};

export class MemoryNotificationRepository implements NotificationRepository {
  private readonly pushes: Array<{
    id: string;
    userId: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    createdAt: Date;
    revokedAt: Date | null;
  }> = [];
  private readonly deliveries: Array<
    NotificationDelivery & { userId: string; idempotencyKey: string }
  > = [];

  async upsertPush(userId: string, endpoint: string, keys: PushKeys, now: Date) {
    const existing = this.pushes.find((item) => item.endpoint === endpoint);

    if (existing) {
      existing.userId = userId;
      existing.p256dh = keys.p256dh;
      existing.auth = keys.auth;
      existing.revokedAt = null;
      return { id: existing.id, createdAt: existing.createdAt };
    }

    const created = {
      id: newEntityId(),
      userId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      createdAt: now,
      revokedAt: null
    };
    this.pushes.push(created);
    return { id: created.id, createdAt: now };
  }

  async revokePush(userId: string, id: string, now: Date) {
    const item = this.pushes.find((push) => push.id === id && push.userId === userId);

    if (!item) {
      return false;
    }

    item.revokedAt = now;
    return true;
  }

  async activePush(userId: string) {
    return this.pushes
      .filter((item) => item.userId === userId && item.revokedAt === null)
      .map((item) => ({
        id: item.id,
        endpoint: item.endpoint,
        p256dh: item.p256dh,
        auth: item.auth
      }));
  }

  async purgeRevoked(before: Date) {
    const beforeCount = this.pushes.length;

    for (let index = this.pushes.length - 1; index >= 0; index -= 1) {
      const revokedAt = this.pushes[index]?.revokedAt;

      if (revokedAt && revokedAt.getTime() <= before.getTime()) {
        this.pushes.splice(index, 1);
      }
    }

    return beforeCount - this.pushes.length;
  }

  async claimDelivery(draft: DeliveryDraft): Promise<DeliveryClaim | null> {
    const existing = this.deliveries.find((item) => item.idempotencyKey === draft.idempotencyKey);

    if (existing) {
      if (existing.userId !== draft.userId) {
        return null;
      }

      return {
        id: existing.id,
        status: deliveryStatus(existing.status),
        proceed: existing.status === "pending" || existing.status === "failed"
      };
    }

    const created: NotificationDelivery & { userId: string; idempotencyKey: string } = {
      id: newEntityId(),
      userId: draft.userId,
      eventType: draft.eventType,
      channel: draft.channel,
      status: "pending",
      createdAt: draft.now.toISOString(),
      idempotencyKey: draft.idempotencyKey
    };
    this.deliveries.push(created);
    return { id: created.id, status: "pending" as const, proceed: true };
  }

  async finishDelivery(
    userId: string,
    id: string,
    status: NotificationStatus,
    providerMessageId: string | null,
    now: Date
  ) {
    const item = this.deliveries.find(
      (delivery) => delivery.id === id && delivery.userId === userId
    );

    if (!item) {
      return;
    }

    item.status = status;
    item.createdAt = now.toISOString();

    if (providerMessageId) {
      item.createdAt = now.toISOString();
    }
  }

  async listRecent(userId: string, limit: number) {
    return this.deliveries
      .filter((item) => item.userId === userId)
      .slice(-limit)
      .reverse()
      .map(({ id, eventType, channel, status, createdAt }) => ({
        id,
        eventType,
        channel,
        status,
        createdAt
      }));
  }

  async countDeliveries() {
    const counts = new Map<string, { channel: string; status: string; count: number }>();

    for (const item of this.deliveries) {
      const key = `${item.channel}:${item.status}`;
      const current = counts.get(key) ?? { channel: item.channel, status: item.status, count: 0 };
      current.count += 1;
      counts.set(key, current);
    }

    return [...counts.values()];
  }
}

function deliveryStatus(status: string): NotificationStatus {
  if (status === "sent" || status === "failed" || status === "skipped" || status === "pending") {
    return status;
  }

  return "pending";
}
