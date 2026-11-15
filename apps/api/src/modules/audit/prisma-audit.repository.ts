import type { PrismaClient } from "../../generated/prisma/client.js";
import { parseUuid } from "../../shared/public-id.js";
import type { AuditRecord, AuditRepository } from "./audit.types.js";

export class PrismaAuditRepository implements AuditRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async insert(record: AuditRecord): Promise<void> {
    const userId = record.userId === null ? null : parseUuid(record.userId);

    if (record.userId !== null && !userId) {
      throw new Error("Некорректный идентификатор пользователя в журнале аудита");
    }

    await this.prisma.auditEvent.create({
      data: {
        userId,
        action: record.action,
        target: record.target,
        createdAt: record.createdAt,
        deleteAt: record.deleteAt
      }
    });
  }

  async deleteForUser(userId: string): Promise<void> {
    const id = parseUuid(userId);

    if (!id) {
      throw new Error("Некорректный идентификатор пользователя в журнале аудита");
    }

    await this.prisma.auditEvent.deleteMany({ where: { userId: id } });
  }
}
