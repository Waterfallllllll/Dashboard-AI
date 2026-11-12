import type { Db } from "mongodb";

import { parseObjectId } from "../../shared/object-id.js";
import type { AuditRecord, AuditRepository } from "./audit.types.js";

export class MemoryAuditRepository implements AuditRepository {
  readonly records: AuditRecord[] = [];

  async insert(record: AuditRecord): Promise<void> {
    this.records.push({ ...record });
  }

  async deleteForUser(userId: string): Promise<void> {
    const kept = this.records.filter((record) => record.userId !== userId);
    this.records.splice(0, this.records.length, ...kept);
  }
}

export class MongoAuditRepository implements AuditRepository {
  constructor(private readonly db: Db) {}

  async insert(record: AuditRecord): Promise<void> {
    const userId = record.userId === null ? null : parseObjectId(record.userId);

    if (record.userId !== null && !userId) {
      throw new Error("Некорректный идентификатор пользователя в журнале аудита");
    }

    await this.db.collection("audit_events").insertOne({
      schemaVersion: 1,
      userId,
      action: record.action,
      target: record.target,
      createdAt: record.createdAt,
      deleteAt: record.deleteAt
    });
  }

  async deleteForUser(userId: string): Promise<void> {
    const id = parseObjectId(userId);

    if (!id) {
      throw new Error("Некорректный идентификатор пользователя в журнале аудита");
    }

    await this.db.collection("audit_events").deleteMany({ userId: id });
  }
}
