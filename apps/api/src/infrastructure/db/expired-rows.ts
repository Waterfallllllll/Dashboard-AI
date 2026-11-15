import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import { WORKER_DELETE_POLICIES } from "./retention.js";

export const EXPIRED_ROW_BATCH = 200;

const MAX_PASSES = 10;

export const EXPIRED_ROW_TABLES = [
  "sessions",
  "one_time_tokens",
  "notification_deliveries",
  "audit_events",
  "scheduled_jobs"
] as const;

export type ExpiredRowTable = (typeof EXPIRED_ROW_TABLES)[number];

export type ExpiredRowCounts = Record<ExpiredRowTable, number>;

export function expiredRowStatements(now: Date): Record<ExpiredRowTable, Prisma.Sql> {
  return {
    sessions: Prisma.sql`
      DELETE FROM "sessions"
      WHERE "id" IN (
        SELECT "id"
        FROM "sessions"
        WHERE "expires_at" <= ${now}
        ORDER BY "expires_at"
        LIMIT ${EXPIRED_ROW_BATCH}
      )
    `,
    one_time_tokens: Prisma.sql`
      DELETE FROM "one_time_tokens"
      WHERE "id" IN (
        SELECT "id"
        FROM "one_time_tokens"
        WHERE "expires_at" <= ${now}
        ORDER BY "expires_at"
        LIMIT ${EXPIRED_ROW_BATCH}
      )
    `,
    notification_deliveries: Prisma.sql`
      DELETE FROM "notification_deliveries"
      WHERE "id" IN (
        SELECT "id"
        FROM "notification_deliveries"
        WHERE "delete_at" <= ${now}
        ORDER BY "delete_at"
        LIMIT ${EXPIRED_ROW_BATCH}
      )
    `,
    audit_events: Prisma.sql`
      DELETE FROM "audit_events"
      WHERE "id" IN (
        SELECT "id"
        FROM "audit_events"
        WHERE "delete_at" <= ${now}
        ORDER BY "delete_at"
        LIMIT ${EXPIRED_ROW_BATCH}
      )
    `,
    scheduled_jobs: Prisma.sql`
      DELETE FROM "scheduled_jobs"
      WHERE "id" IN (
        SELECT "id"
        FROM "scheduled_jobs"
        WHERE "delete_at" <= ${now}
          AND "status" IN ('completed'::"job_status", 'failed'::"job_status")
          AND "type" NOT IN (
            'scheduler-lock'::"scheduled_job_type",
            'worker-heartbeat'::"scheduled_job_type"
          )
        ORDER BY "delete_at"
        LIMIT ${EXPIRED_ROW_BATCH}
      )
    `
  };
}

export function assertExpiredRowCoverage(): void {
  const tables = new Set<string>(EXPIRED_ROW_TABLES);

  if (tables.size !== EXPIRED_ROW_TABLES.length) {
    throw new Error("Список очистки просроченных строк содержит повтор");
  }

  for (const policy of WORKER_DELETE_POLICIES) {
    if (!tables.has(policy.table)) {
      throw new Error(`Для ${policy.table} нет удаления просроченных строк`);
    }
  }

  if (tables.size !== WORKER_DELETE_POLICIES.length) {
    throw new Error("Очистка удаляет таблицу вне правил хранения");
  }
}

export async function purgeExpiredRows(prisma: PrismaClient, now: Date): Promise<ExpiredRowCounts> {
  assertExpiredRowCoverage();
  const statements = expiredRowStatements(now);

  return {
    sessions: await deleteInBatches(prisma, statements.sessions),
    one_time_tokens: await deleteInBatches(prisma, statements.one_time_tokens),
    notification_deliveries: await deleteInBatches(prisma, statements.notification_deliveries),
    audit_events: await deleteInBatches(prisma, statements.audit_events),
    scheduled_jobs: await deleteInBatches(prisma, statements.scheduled_jobs)
  };
}

async function deleteInBatches(prisma: PrismaClient, statement: Prisma.Sql): Promise<number> {
  let total = 0;

  for (let pass = 0; pass < MAX_PASSES; pass += 1) {
    const deleted = await prisma.$executeRaw(statement);
    total += deleted;

    if (deleted < EXPIRED_ROW_BATCH) {
      return total;
    }
  }

  return total;
}
