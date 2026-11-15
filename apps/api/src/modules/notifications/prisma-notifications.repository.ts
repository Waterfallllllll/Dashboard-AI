import { createHash } from "node:crypto";

import type { NotificationDelivery, NotificationStatus } from "@dashboard/contracts";

import type { PrismaClient } from "../../generated/prisma/client.js";
import type { CredentialCipher } from "../../infrastructure/crypto/credential-cipher.js";
import { CREDENTIAL_PURPOSES } from "../../infrastructure/crypto/credential-cipher.js";
import { notificationDeleteAt } from "../../infrastructure/db/retention.js";
import { isUniqueViolation } from "../../shared/prisma-error.js";
import { newEntityId, parseUuid } from "../../shared/public-id.js";
import type {
  DeliveryClaim,
  DeliveryDraft,
  NotificationRepository,
  PushKeys,
  PushTarget
} from "./notifications.repository.js";

export class PrismaNotificationRepository implements NotificationRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly cipher: CredentialCipher
  ) {}

  async upsertPush(
    userId: string,
    endpoint: string,
    keys: PushKeys,
    now: Date
  ): Promise<{ id: string; createdAt: Date } | null> {
    const owner = parseUuid(userId);

    if (!owner) {
      return null;
    }

    const endpointHash = hashEndpoint(endpoint);
    const encryptedKeys = this.cipher.encrypt(JSON.stringify(keys), CREDENTIAL_PURPOSES.pushKeys);
    const existing = await this.prisma.pushSubscription.findUnique({ where: { endpointHash } });

    if (existing) {
      await this.prisma.pushSubscription.update({
        where: { id: existing.id },
        data: { userId: owner, endpoint, keys: encryptedKeys, revokedAt: null }
      });
      return { id: existing.id, createdAt: existing.createdAt };
    }

    const id = newEntityId();

    try {
      await this.prisma.pushSubscription.create({
        data: {
          id,
          userId: owner,
          endpointHash,
          endpoint,
          keys: encryptedKeys,
          createdAt: now
        }
      });
      return { id, createdAt: now };
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }

      const again = await this.prisma.pushSubscription.findUnique({ where: { endpointHash } });
      return again ? { id: again.id, createdAt: again.createdAt } : null;
    }
  }

  async revokePush(userId: string, id: string, now: Date): Promise<boolean> {
    const filter = ownedPush(userId, id);

    if (!filter) {
      return false;
    }

    const updated = await this.prisma.pushSubscription.updateMany({
      where: filter,
      data: { revokedAt: now }
    });
    return updated.count === 1;
  }

  async activePush(userId: string): Promise<readonly PushTarget[]> {
    const owner = parseUuid(userId);

    if (!owner) {
      return [];
    }

    const rows = await this.prisma.pushSubscription.findMany({
      where: { userId: owner, revokedAt: null },
      take: 20
    });
    const targets: PushTarget[] = [];

    for (const row of rows) {
      const keys = this.readKeys(row.keys);

      if (!keys) {
        await this.prisma.pushSubscription.update({
          where: { id: row.id },
          data: { revokedAt: new Date() }
        });
        continue;
      }

      targets.push({ id: row.id, endpoint: row.endpoint, ...keys });
    }

    return targets;
  }

  async purgeRevoked(before: Date): Promise<number> {
    const result = await this.prisma.pushSubscription.deleteMany({
      where: { revokedAt: { lte: before } }
    });
    return result.count;
  }

  async claimDelivery(draft: DeliveryDraft): Promise<DeliveryClaim | null> {
    const userId = parseUuid(draft.userId);

    if (!userId || draft.idempotencyKey.length < 8) {
      return null;
    }

    const id = newEntityId();

    try {
      await this.prisma.notificationDelivery.create({
        data: {
          id,
          userId,
          eventType: draft.eventType,
          channel: draft.channel,
          idempotencyKey: draft.idempotencyKey,
          status: "pending",
          createdAt: draft.now,
          updatedAt: draft.now,
          deleteAt: notificationDeleteAt(draft.now)
        }
      });
      return { id, status: "pending", proceed: true };
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
    }

    const existing = await this.prisma.notificationDelivery.findUnique({
      where: { idempotencyKey: draft.idempotencyKey }
    });

    if (!existing || existing.userId !== userId) {
      return null;
    }

    return {
      id: existing.id,
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
  ): Promise<void> {
    const filter = ownedDelivery(userId, id);

    if (!filter) {
      return;
    }

    await this.prisma.notificationDelivery.updateMany({
      where: filter,
      data: {
        status,
        providerMessageId,
        updatedAt: now,
        attempts: { increment: 1 }
      }
    });
  }

  async listRecent(userId: string, limit: number): Promise<readonly NotificationDelivery[]> {
    const owner = parseUuid(userId);

    if (!owner) {
      return [];
    }

    const rows = await this.prisma.notificationDelivery.findMany({
      where: { userId: owner },
      orderBy: { createdAt: "desc" },
      take: limit
    });
    return rows.map((row) => ({
      id: row.id,
      eventType: row.eventType,
      channel: row.channel,
      status: deliveryStatus(row.status),
      createdAt: row.createdAt.toISOString()
    }));
  }

  async countDeliveries(): Promise<readonly { channel: string; status: string; count: number }[]> {
    const rows = await this.prisma.notificationDelivery.groupBy({
      by: ["channel", "status"],
      _count: { _all: true }
    });
    return rows.map((row) => ({
      channel: row.channel,
      status: row.status,
      count: row._count._all
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
  const owner = parseUuid(userId);
  const pushId = parseUuid(id);
  return owner && pushId ? { id: pushId, userId: owner } : null;
}

function ownedDelivery(userId: string, id: string) {
  const owner = parseUuid(userId);
  const deliveryId = parseUuid(id);
  return owner && deliveryId ? { id: deliveryId, userId: owner } : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
