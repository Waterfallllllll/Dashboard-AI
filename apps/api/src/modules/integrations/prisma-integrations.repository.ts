import type { PrismaClient } from "../../generated/prisma/client.js";
import { newEntityId, parseUuid } from "../../shared/public-id.js";
import type {
  IntegrationKind,
  IntegrationRecord,
  IntegrationWrite,
  IntegrationsRepository,
  TokenPurpose,
  TokenWrite
} from "./integrations.repository.js";

type IntegrationRow = {
  id: string;
  userId: string;
  type: IntegrationKind;
  status: string;
  credentials: string | null;
  scope: string[];
  externalUserId: string | null;
  lastSyncAt: Date | null;
  syncCursor: string | null;
  watchChannelId: string | null;
  watchResourceId: string | null;
  watchExpiresAt: Date | null;
};

export class PrismaIntegrationsRepository implements IntegrationsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(userId: string): Promise<readonly IntegrationRecord[]> {
    const id = parseUuid(userId);

    if (!id) {
      return [];
    }

    const rows = await this.prisma.integration.findMany({
      where: { userId: id, deletedAt: null }
    });
    return rows.flatMap((row) => {
      const record = toRecord(row);
      return record ? [record] : [];
    });
  }

  async find(userId: string, type: IntegrationKind): Promise<IntegrationRecord | null> {
    const id = parseUuid(userId);

    if (!id) {
      return null;
    }

    const row = await this.prisma.integration.findFirst({
      where: { userId: id, type, deletedAt: null }
    });
    return row ? toRecord(row) : null;
  }

  async upsert(input: IntegrationWrite): Promise<IntegrationRecord | null> {
    const userId = parseUuid(input.userId);

    if (!userId) {
      return null;
    }

    const existing = await this.prisma.integration.findFirst({
      where: { userId, type: input.type, deletedAt: null }
    });

    if (existing) {
      const updated = await this.prisma.integration.update({
        where: { id: existing.id },
        data: {
          status: "connected",
          credentials: input.encryptedCredentials,
          scope: [...input.scope],
          externalUserId: input.externalUserId,
          updatedAt: input.now
        }
      });
      return toRecord(updated);
    }

    const created = await this.prisma.integration.create({
      data: {
        id: newEntityId(),
        userId,
        type: input.type,
        status: "connected",
        credentials: input.encryptedCredentials,
        scope: [...input.scope],
        externalUserId: input.externalUserId,
        createdAt: input.now,
        updatedAt: input.now
      }
    });
    return toRecord(created);
  }

  async saveSync(
    userId: string,
    cursor: string | null,
    encryptedCredentials: string | null,
    now: Date
  ): Promise<void> {
    const id = parseUuid(userId);

    if (!id) {
      return;
    }

    await this.prisma.integration.updateMany({
      where: { userId: id, type: "google_calendar", deletedAt: null, status: "connected" },
      data: {
        lastSyncAt: now,
        updatedAt: now,
        syncCursor: cursor,
        ...(encryptedCredentials ? { credentials: encryptedCredentials } : {})
      }
    });
  }

  async markRevoked(userId: string, now: Date): Promise<void> {
    const id = parseUuid(userId);

    if (!id) {
      return;
    }

    await this.prisma.integration.updateMany({
      where: { userId: id, type: "google_calendar", deletedAt: null },
      data: {
        status: "revoked",
        credentials: null,
        syncCursor: null,
        updatedAt: now
      }
    });
  }

  async softDelete(userId: string, type: IntegrationKind, now: Date): Promise<boolean> {
    const id = parseUuid(userId);

    if (!id) {
      return false;
    }

    const updated = await this.prisma.integration.updateMany({
      where: { userId: id, type, deletedAt: null },
      data: { deletedAt: now, updatedAt: now }
    });
    return updated.count === 1;
  }

  async saveToken(input: TokenWrite): Promise<void> {
    await this.prisma.oneTimeToken.create({
      data: {
        tokenHash: input.tokenHash,
        purpose: input.purpose,
        payload: input.encryptedPayload,
        expiresAt: input.expiresAt,
        createdAt: input.now
      }
    });
  }

  async consumeToken(
    purpose: TokenPurpose,
    tokenHash: string,
    now: Date
  ): Promise<{ encryptedPayload: string } | null> {
    return this.prisma.$transaction(async (tx) => {
      const token = await tx.oneTimeToken.findFirst({
        where: { tokenHash, purpose, consumedAt: null, expiresAt: { gt: now } }
      });

      if (!token) {
        return null;
      }

      const consumed = await tx.oneTimeToken.updateMany({
        where: { id: token.id, consumedAt: null },
        data: { consumedAt: now }
      });
      return consumed.count === 1 ? { encryptedPayload: token.payload } : null;
    });
  }

  async listConnectedUserIds(type: IntegrationKind, limit: number): Promise<readonly string[]> {
    const rows = await this.prisma.integration.findMany({
      where: { type, status: "connected", deletedAt: null },
      select: { userId: true },
      take: limit
    });
    return rows.map((row) => row.userId);
  }

  async listCalendarWatches(limit: number) {
    const rows = await this.prisma.integration.findMany({
      where: { type: "google_calendar", status: "connected", deletedAt: null },
      take: limit
    });
    return rows.map((row) => ({
      userId: row.userId,
      channelId: row.watchChannelId,
      resourceId: row.watchResourceId,
      expiresAt: row.watchExpiresAt
    }));
  }

  async saveCalendarWatch(
    userId: string,
    watch: { channelId: string; resourceId: string; expiresAt: Date },
    now: Date
  ): Promise<void> {
    const id = parseUuid(userId);

    if (!id) {
      return;
    }

    await this.prisma.integration.updateMany({
      where: { userId: id, type: "google_calendar", deletedAt: null },
      data: {
        watchChannelId: watch.channelId,
        watchResourceId: watch.resourceId,
        watchExpiresAt: watch.expiresAt,
        updatedAt: now
      }
    });
  }
}

function toRecord(row: IntegrationRow): IntegrationRecord | null {
  if (row.status !== "connected" && row.status !== "revoked") {
    return null;
  }

  if (row.type !== "google_calendar" && row.type !== "telegram") {
    return null;
  }

  return {
    id: row.id,
    userId: row.userId,
    type: row.type,
    status: row.status,
    encryptedCredentials: row.credentials,
    scope: row.scope,
    externalUserId: row.externalUserId,
    lastSyncAt: row.lastSyncAt,
    syncCursor: row.syncCursor
  };
}
