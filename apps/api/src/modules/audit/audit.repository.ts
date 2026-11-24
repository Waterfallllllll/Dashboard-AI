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
