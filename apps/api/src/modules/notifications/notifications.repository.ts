import { createHash } from "node:crypto";

import type {
  NotificationChannel,
  NotificationDelivery,
  NotificationEvent,
  NotificationStatus
} from "@dashboard/contracts";
import { ObjectId, type Db } from "mongodb";

import type { CredentialCipher } from "../../infrastructure/crypto/credential-cipher.js";
import { CREDENTIAL_PURPOSES } from "../../infrastructure/crypto/credential-cipher.js";
import type {
  NotificationDeliveryDocument,
  PushSubscriptionDocument
} from "../../infrastructure/mongodb/collection-catalog.js";
import { notificationDeleteAt } from "../../infrastructure/mongodb/retention.js";
import { isDuplicateKey } from "../../shared/mongo-error.js";
import { parseObjectId } from "../../shared/object-id.js";

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

export class MongoNotificationRepository implements NotificationRepository {
  constructor(
    private readonly db: Db,
    private readonly cipher: CredentialCipher
  ) {}

  async upsertPush(userId: string, endpoint: string, keys: PushKeys, now: Date) {
    const owner = parseObjectId(userId);

    if (!owner) {
      return null;
    }

    const endpointHash = hashEndpoint(endpoint);
    const encryptedKeys = this.cipher.encrypt(JSON.stringify(keys), CREDENTIAL_PURPOSES.pushKeys);
    const existing = await this.pushes().findOne({ endpointHash });

    if (existing) {
      await this.pushes().updateOne(
        { _id: existing._id },
        { $set: { userId: owner, endpoint, encryptedKeys, revokedAt: null } }
      );
      return { id: existing._id.toHexString(), createdAt: existing.createdAt };
    }

    const id = new ObjectId();

    try {
      await this.pushes().insertOne({
        _id: id,
        schemaVersion: 1,
        userId: owner,
        endpointHash,
        endpoint,
        encryptedKeys,
        createdAt: now,
        revokedAt: null
      });
      return { id: id.toHexString(), createdAt: now };
    } catch (error) {
      if (!isDuplicateKey(error)) {
        throw error;
      }

      const again = await this.pushes().findOne({ endpointHash });
      return again ? { id: again._id.toHexString(), createdAt: again.createdAt } : null;
    }
  }

  async revokePush(userId: string, id: string, now: Date) {
    const filter = ownedPush(userId, id);

    if (!filter) {
      return false;
    }

    const result = await this.pushes().updateOne(filter, { $set: { revokedAt: now } });
    return result.matchedCount === 1;
  }

  async activePush(userId: string) {
    const owner = parseObjectId(userId);

    if (!owner) {
      return [];
    }

    const documents = await this.pushes()
      .find({ userId: owner, revokedAt: null })
      .limit(20)
      .toArray();
    const targets: PushTarget[] = [];

    for (const document of documents) {
      const keys = this.readKeys(document.encryptedKeys);

      if (!keys) {
        await this.pushes().updateOne({ _id: document._id }, { $set: { revokedAt: new Date() } });
        continue;
      }

      targets.push({ id: document._id.toHexString(), endpoint: document.endpoint, ...keys });
    }

    return targets;
  }

  async purgeRevoked(before: Date) {
    const result = await this.pushes().deleteMany({ revokedAt: { $lte: before, $type: "date" } });
    return result.deletedCount;
  }

  async claimDelivery(draft: DeliveryDraft): Promise<DeliveryClaim | null> {
    const userId = parseObjectId(draft.userId);

    if (!userId || draft.idempotencyKey.length < 8) {
      return null;
    }

    const document: NotificationDeliveryDocument = {
      _id: new ObjectId(),
      schemaVersion: 1,
      userId,
      eventType: draft.eventType,
      channel: draft.channel,
      idempotencyKey: draft.idempotencyKey,
      status: "pending",
      attempts: 0,
      providerMessageId: null,
      createdAt: draft.now,
      updatedAt: draft.now,
      deleteAt: notificationDeleteAt(draft.now)
    };

    try {
      await this.deliveries().insertOne(document);
      return { id: document._id.toHexString(), status: "pending" as const, proceed: true };
    } catch (error) {
      if (!isDuplicateKey(error)) {
        throw error;
      }
    }

    const existing = await this.deliveries().findOne({ idempotencyKey: draft.idempotencyKey });

    if (!existing || !existing.userId.equals(userId)) {
      return null;
    }

    return {
      id: existing._id.toHexString(),
      status: deliveryStatus(existing.status),
      proceed: existing.status === "pending" || existing.status === "failed"
    };
  }

  async finishDelivery(
    userId: string,
    id: string,
    status: NotificationStatus,
    providerMessageId: string | null,
    now: Date
  ) {
    const filter = ownedDelivery(userId, id);

    if (!filter) {
      return;
    }

    await this.deliveries().updateOne(filter, {
      $set: { status, providerMessageId, updatedAt: now },
      $inc: { attempts: 1 }
    });
  }

  async listRecent(userId: string, limit: number) {
    const owner = parseObjectId(userId);

    if (!owner) {
      return [];
    }

    const documents = await this.deliveries()
      .find({ userId: owner })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    return documents.map(toDelivery);
  }

  async countDeliveries() {
    const rows = await this.deliveries()
      .aggregate<{ _id: { channel: string; status: string }; count: number }>([
        { $group: { _id: { channel: "$channel", status: "$status" }, count: { $sum: 1 } } }
      ])
      .toArray();
    return rows.map((row) => ({
      channel: row._id.channel,
      status: row._id.status,
      count: row.count
    }));
  }

  private readKeys(payload: string): PushKeys | null {
    try {
      const parsed: unknown = JSON.parse(
        this.cipher.decrypt(payload, CREDENTIAL_PURPOSES.pushKeys)
      );

      if (
        !isRecord(parsed) ||
        typeof parsed.p256dh !== "string" ||
        typeof parsed.auth !== "string"
      ) {
        return null;
      }

      return { p256dh: parsed.p256dh, auth: parsed.auth };
    } catch {
      return null;
    }
  }

  private pushes() {
    return this.db.collection<PushSubscriptionDocument>("push_subscriptions");
  }

  private deliveries() {
    return this.db.collection<NotificationDeliveryDocument>("notification_deliveries");
  }
}

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
      id: new ObjectId().toHexString(),
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
      id: new ObjectId().toHexString(),
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

function hashEndpoint(endpoint: string): string {
  return createHash("sha256").update(endpoint).digest("hex");
}

function ownedPush(userId: string, id: string) {
  const owner = parseObjectId(userId);
  const pushId = parseObjectId(id);
  return owner && pushId ? { _id: pushId, userId: owner } : null;
}

function ownedDelivery(userId: string, id: string) {
  const owner = parseObjectId(userId);
  const deliveryId = parseObjectId(id);
  return owner && deliveryId ? { _id: deliveryId, userId: owner } : null;
}

function toDelivery(document: NotificationDeliveryDocument): NotificationDelivery {
  return {
    id: document._id.toHexString(),
    eventType: document.eventType,
    channel: document.channel,
    status: document.status,
    createdAt: document.createdAt.toISOString()
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
