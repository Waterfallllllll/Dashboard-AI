import { ObjectId, type Db } from "mongodb";

import type {
  IntegrationDocument,
  OneTimeTokenDocument
} from "../../infrastructure/mongodb/collection-catalog.js";
import { softDeleteById } from "../../infrastructure/mongodb/soft-delete.js";
import { parseObjectId } from "../../shared/object-id.js";

export type IntegrationKind = "google_calendar" | "telegram";
export type TokenPurpose = "calendar_oauth" | "telegram_link";

export type IntegrationRecord = {
  readonly id: string;
  readonly userId: string;
  readonly type: IntegrationKind;
  readonly status: "connected" | "revoked";
  readonly encryptedCredentials: string | null;
  readonly scope: readonly string[];
  readonly externalUserId: string | null;
  readonly lastSyncAt: Date | null;
  readonly syncCursor: string | null;
};

export type IntegrationWrite = {
  readonly userId: string;
  readonly type: IntegrationKind;
  readonly encryptedCredentials: string | null;
  readonly scope: readonly string[];
  readonly externalUserId: string | null;
  readonly now: Date;
};

export type TokenWrite = {
  readonly purpose: TokenPurpose;
  readonly tokenHash: string;
  readonly encryptedPayload: string;
  readonly expiresAt: Date;
  readonly now: Date;
};

export type IntegrationsRepository = {
  list(userId: string): Promise<readonly IntegrationRecord[]>;
  find(userId: string, type: IntegrationKind): Promise<IntegrationRecord | null>;
  upsert(input: IntegrationWrite): Promise<IntegrationRecord | null>;
  saveSync(
    userId: string,
    cursor: string | null,
    encryptedCredentials: string | null,
    now: Date
  ): Promise<void>;
  markRevoked(userId: string, now: Date): Promise<void>;
  softDelete(userId: string, type: IntegrationKind, now: Date): Promise<boolean>;
  saveToken(input: TokenWrite): Promise<void>;
  consumeToken(
    purpose: TokenPurpose,
    tokenHash: string,
    now: Date
  ): Promise<{ encryptedPayload: string } | null>;
  listConnectedUserIds(type: IntegrationKind, limit: number): Promise<readonly string[]>;
  listCalendarWatches(limit: number): Promise<
    readonly {
      userId: string;
      channelId: string | null;
      resourceId: string | null;
      expiresAt: Date | null;
    }[]
  >;
  saveCalendarWatch(
    userId: string,
    watch: { channelId: string; resourceId: string; expiresAt: Date },
    now: Date
  ): Promise<void>;
};

export class MongoIntegrationsRepository implements IntegrationsRepository {
  constructor(private readonly db: Db) {}

  async list(userId: string): Promise<readonly IntegrationRecord[]> {
    const id = parseObjectId(userId);

    if (!id) {
      return [];
    }

    const documents = await this.integrations().find({ userId: id, deletedAt: null }).toArray();
    return documents.flatMap((document) => {
      const record = toRecord(document);
      return record ? [record] : [];
    });
  }

  async find(userId: string, type: IntegrationKind): Promise<IntegrationRecord | null> {
    const id = parseObjectId(userId);

    if (!id) {
      return null;
    }

    const document = await this.integrations().findOne({ userId: id, type, deletedAt: null });
    return document ? toRecord(document) : null;
  }

  async upsert(input: IntegrationWrite): Promise<IntegrationRecord | null> {
    const userId = parseObjectId(input.userId);

    if (!userId) {
      return null;
    }

    const existing = await this.integrations().findOne({
      userId,
      type: input.type,
      deletedAt: null
    });

    if (existing) {
      const updated = await this.integrations().findOneAndUpdate(
        { _id: existing._id, deletedAt: null },
        {
          $set: {
            status: "connected",
            encryptedCredentials: input.encryptedCredentials,
            scope: [...input.scope],
            externalUserId: input.externalUserId,
            updatedAt: input.now
          }
        },
        { returnDocument: "after" }
      );
      return updated ? toRecord(updated) : null;
    }

    const document: IntegrationDocument = {
      _id: new ObjectId(),
      schemaVersion: 1,
      userId,
      type: input.type,
      status: "connected",
      encryptedCredentials: input.encryptedCredentials,
      scope: [...input.scope],
      externalUserId: input.externalUserId,
      lastSyncAt: null,
      syncCursor: null,
      createdAt: input.now,
      updatedAt: input.now,
      deletedAt: null
    };
    await this.integrations().insertOne(document);
    return toRecord(document);
  }

  async saveSync(
    userId: string,
    cursor: string | null,
    encryptedCredentials: string | null,
    now: Date
  ): Promise<void> {
    const id = parseObjectId(userId);

    if (!id) {
      return;
    }

    await this.integrations().updateOne(
      { userId: id, type: "google_calendar", deletedAt: null, status: "connected" },
      {
        $set: {
          lastSyncAt: now,
          updatedAt: now,
          syncCursor: cursor,
          ...(encryptedCredentials ? { encryptedCredentials } : {})
        }
      }
    );
  }

  async markRevoked(userId: string, now: Date): Promise<void> {
    const id = parseObjectId(userId);

    if (!id) {
      return;
    }

    await this.integrations().updateOne(
      { userId: id, type: "google_calendar", deletedAt: null },
      {
        $set: {
          status: "revoked",
          encryptedCredentials: null,
          syncCursor: null,
          updatedAt: now
        }
      }
    );
  }

  async softDelete(userId: string, type: IntegrationKind, now: Date): Promise<boolean> {
    const id = parseObjectId(userId);

    if (!id) {
      return false;
    }

    const existing = await this.integrations().findOne({ userId: id, type, deletedAt: null });

    if (!existing) {
      return false;
    }

    const result = await softDeleteById(this.integrations(), existing._id, now);
    return result === "deleted" || result === "already-deleted";
  }

  async saveToken(input: TokenWrite): Promise<void> {
    await this.tokens().insertOne({
      _id: new ObjectId(),
      schemaVersion: 1,
      tokenHash: input.tokenHash,
      purpose: input.purpose,
      encryptedPayload: input.encryptedPayload,
      expiresAt: input.expiresAt,
      createdAt: input.now,
      consumedAt: null
    });
  }

  async consumeToken(
    purpose: TokenPurpose,
    tokenHash: string,
    now: Date
  ): Promise<{ encryptedPayload: string } | null> {
    const document = await this.tokens().findOneAndUpdate(
      { tokenHash, purpose, consumedAt: null, expiresAt: { $gt: now } },
      { $set: { consumedAt: now } },
      { returnDocument: "before" }
    );
    return document ? { encryptedPayload: document.encryptedPayload } : null;
  }

  async listConnectedUserIds(type: IntegrationKind, limit: number): Promise<readonly string[]> {
    const documents = await this.integrations()
      .find({ type, status: "connected", deletedAt: null })
      .limit(limit)
      .toArray();
    return documents.map((document) => document.userId.toHexString());
  }

  async listCalendarWatches(limit: number) {
    const documents = await this.integrations()
      .find({ type: "google_calendar", status: "connected", deletedAt: null })
      .limit(limit)
      .toArray();
    return documents.map((document) => ({
      userId: document.userId.toHexString(),
      channelId: document.watchChannelId ?? null,
      resourceId: document.watchResourceId ?? null,
      expiresAt: document.watchExpiresAt ?? null
    }));
  }

  async saveCalendarWatch(
    userId: string,
    watch: { channelId: string; resourceId: string; expiresAt: Date },
    now: Date
  ) {
    const id = parseObjectId(userId);

    if (!id) {
      return;
    }

    await this.integrations().updateOne(
      { userId: id, type: "google_calendar", deletedAt: null },
      {
        $set: {
          watchChannelId: watch.channelId,
          watchResourceId: watch.resourceId,
          watchExpiresAt: watch.expiresAt,
          updatedAt: now
        }
      }
    );
  }

  private integrations() {
    return this.db.collection<IntegrationDocument>("integrations");
  }

  private tokens() {
    return this.db.collection<OneTimeTokenDocument>("one_time_tokens");
  }
}

export class MemoryIntegrationsRepository implements IntegrationsRepository {
  private readonly integrations: IntegrationRecord[] = [];
  private readonly watches = new Map<
    string,
    { channelId: string; resourceId: string; expiresAt: Date; savedAt: Date }
  >();
  private readonly tokens: {
    purpose: TokenPurpose;
    tokenHash: string;
    encryptedPayload: string;
    expiresAt: Date;
    consumedAt: Date | null;
  }[] = [];

  async list(userId: string): Promise<readonly IntegrationRecord[]> {
    return this.integrations.filter((item) => item.userId === userId);
  }

  async find(userId: string, type: IntegrationKind): Promise<IntegrationRecord | null> {
    return this.integrations.find((item) => item.userId === userId && item.type === type) ?? null;
  }

  async upsert(input: IntegrationWrite): Promise<IntegrationRecord | null> {
    const existing = this.integrations.find(
      (item) => item.userId === input.userId && item.type === input.type
    );
    const record: IntegrationRecord = {
      id: existing?.id ?? new ObjectId().toHexString(),
      userId: input.userId,
      type: input.type,
      status: "connected",
      encryptedCredentials: input.encryptedCredentials,
      scope: input.scope,
      externalUserId: input.externalUserId,
      lastSyncAt: existing?.lastSyncAt ?? null,
      syncCursor: existing?.syncCursor ?? null
    };

    if (existing) {
      const index = this.integrations.indexOf(existing);
      this.integrations[index] = record;
    } else {
      this.integrations.push(record);
    }

    return record;
  }

  async saveSync(
    userId: string,
    cursor: string | null,
    encryptedCredentials: string | null,
    now: Date
  ): Promise<void> {
    const current = this.integrations.find(
      (item) =>
        item.userId === userId && item.type === "google_calendar" && item.status === "connected"
    );

    if (!current) {
      return;
    }

    const index = this.integrations.indexOf(current);
    this.integrations[index] = {
      ...current,
      syncCursor: cursor,
      lastSyncAt: now,
      encryptedCredentials: encryptedCredentials ?? current.encryptedCredentials
    };
  }

  async markRevoked(userId: string, now: Date): Promise<void> {
    const current = this.integrations.find(
      (item) => item.userId === userId && item.type === "google_calendar"
    );

    if (!current) {
      return;
    }

    const index = this.integrations.indexOf(current);
    this.integrations[index] = {
      ...current,
      status: "revoked",
      encryptedCredentials: null,
      syncCursor: null,
      lastSyncAt: current.lastSyncAt
    };
    void now;
  }

  async softDelete(userId: string, type: IntegrationKind, now: Date): Promise<boolean> {
    const index = this.integrations.findIndex(
      (item) => item.userId === userId && item.type === type
    );

    if (index < 0) {
      return false;
    }

    this.integrations.splice(index, 1);
    void now;
    return true;
  }

  async saveToken(input: TokenWrite): Promise<void> {
    this.tokens.push({
      purpose: input.purpose,
      tokenHash: input.tokenHash,
      encryptedPayload: input.encryptedPayload,
      expiresAt: input.expiresAt,
      consumedAt: null
    });
  }

  async consumeToken(
    purpose: TokenPurpose,
    tokenHash: string,
    now: Date
  ): Promise<{ encryptedPayload: string } | null> {
    const token = this.tokens.find(
      (item) =>
        item.purpose === purpose &&
        item.tokenHash === tokenHash &&
        item.consumedAt === null &&
        item.expiresAt.getTime() > now.getTime()
    );

    if (!token) {
      return null;
    }

    token.consumedAt = now;
    return { encryptedPayload: token.encryptedPayload };
  }

  async listConnectedUserIds(type: IntegrationKind, limit: number): Promise<readonly string[]> {
    return this.integrations
      .filter((item) => item.type === type && item.status === "connected")
      .slice(0, limit)
      .map((item) => item.userId);
  }

  async listCalendarWatches(limit: number) {
    return this.integrations
      .filter((item) => item.type === "google_calendar" && item.status === "connected")
      .slice(0, limit)
      .map((item) => ({
        userId: item.userId,
        channelId: this.watches.get(item.userId)?.channelId ?? null,
        resourceId: this.watches.get(item.userId)?.resourceId ?? null,
        expiresAt: this.watches.get(item.userId)?.expiresAt ?? null
      }));
  }

  async saveCalendarWatch(
    userId: string,
    watch: { channelId: string; resourceId: string; expiresAt: Date },
    now: Date
  ) {
    this.watches.set(userId, { ...watch, savedAt: now });
  }
}

function toRecord(document: IntegrationDocument): IntegrationRecord | null {
  if (document.status !== "connected" && document.status !== "revoked") {
    return null;
  }

  return {
    id: document._id.toHexString(),
    userId: document.userId.toHexString(),
    type: document.type,
    status: document.status,
    encryptedCredentials: document.encryptedCredentials,
    scope: document.scope,
    externalUserId: document.externalUserId,
    lastSyncAt: document.lastSyncAt,
    syncCursor: document.syncCursor
  };
}
