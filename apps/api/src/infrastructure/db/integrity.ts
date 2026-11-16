import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";

import { ALL_PARTIAL_INDEXES, CIPHERTEXT_CHECKS, FOREIGN_KEYS } from "./migration-catalog.js";
import {
  auditRetentionViolation,
  deliveryRetentionViolation,
  type AuditRetentionCode,
  type DeliveryRetentionCode
} from "./retention.js";

const MAX_VIOLATIONS = 50;

const USER_TABLES = [
  "auth_accounts",
  "sessions",
  "widget_preferences",
  "routine_rules",
  "routine_occurrences",
  "timer_presets",
  "timer_sessions",
  "integrations",
  "calendar_events",
  "push_subscriptions",
  "scheduled_jobs",
  "notification_deliveries",
  "audit_events"
] as const;

export type IntegrityCode =
  | "ORPHAN_USER"
  | "ROUTINE_RULE_MISSING"
  | "ROUTINE_OWNER_MISMATCH"
  | "CALENDAR_INTEGRATION_MISSING"
  | "CALENDAR_OWNER_MISMATCH"
  | "DUPLICATE_WIDGET"
  | "DUPLICATE_WIDGET_POSITION"
  | DeliveryRetentionCode
  | AuditRetentionCode
  | "AUDIT_ANONYMOUS_ACTION"
  | "PARTIAL_INDEX_MISSING"
  | "CIPHERTEXT_CHECK_MISSING"
  | "FOREIGN_KEY_MISSING"
  | "UNINDEXED_FOREIGN_KEY";

export type IntegrityViolation = {
  readonly code: IntegrityCode;
  readonly collection: string;
  readonly documentId: string;
};

export type IntegrityReport = {
  readonly ok: boolean;
  readonly violations: readonly IntegrityViolation[];
  readonly truncated: boolean;
};

type IdRow = { id: string | null };
type ParentRow = { id: string | null; owner_mismatch: boolean | null };
type WidgetRow = {
  id: string | null;
  user_id: string | null;
  widget_type: string | null;
  position: number | null;
};
type DatedRow = { id: string | null; created_at: unknown; delete_at: unknown };
type AuditRow = DatedRow & { user_id: string | null; action: string | null };
type ConstraintRow = { name: string; definition: string | null };
type ForeignKeyColumnRow = { table_name: string | null; column_name: string | null };

const UNINDEXED_FOREIGN_KEY_SQL = `
SELECT rel.relname AS table_name, a.attname AS column_name
FROM pg_constraint c
JOIN pg_class rel ON rel.oid = c.conrelid
JOIN pg_namespace n ON n.oid = c.connamespace
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
WHERE c.contype = 'f'
  AND n.nspname = 'public'
  AND NOT EXISTS (
    SELECT 1
    FROM pg_index i
    WHERE i.indrelid = c.conrelid
      AND a.attnum = ANY (i.indkey)
  )
`.trim();

export async function checkDataIntegrity(prisma: PrismaClient): Promise<IntegrityReport> {
  const violations: IntegrityViolation[] = [];
  let truncated = false;
  const stop = () => {
    truncated = true;
  };

  for (const table of USER_TABLES) {
    for (const row of await prisma.$queryRaw<IdRow[]>(orphanSql(table))) {
      push(violations, "ORPHAN_USER", table, row.id, stop);
    }
  }

  for (const row of await prisma.$queryRaw<ParentRow[]>`
    SELECT o."id"::text AS id, (rule_by_id."id" IS NOT NULL) AS owner_mismatch
    FROM "routine_occurrences" o
    LEFT JOIN "routine_rules" rule_match
      ON rule_match."id" = o."routine_rule_id" AND rule_match."user_id" = o."user_id"
    LEFT JOIN "routine_rules" rule_by_id ON rule_by_id."id" = o."routine_rule_id"
    WHERE rule_match."id" IS NULL
  `) {
    push(
      violations,
      row.owner_mismatch ? "ROUTINE_OWNER_MISMATCH" : "ROUTINE_RULE_MISSING",
      "routine_occurrences",
      row.id,
      stop
    );
  }

  for (const row of await prisma.$queryRaw<ParentRow[]>`
    SELECT e."id"::text AS id, (integration_by_id."id" IS NOT NULL) AS owner_mismatch
    FROM "calendar_events" e
    LEFT JOIN "integrations" integration_match
      ON integration_match."id" = e."integration_id" AND integration_match."user_id" = e."user_id"
    LEFT JOIN "integrations" integration_by_id ON integration_by_id."id" = e."integration_id"
    WHERE integration_match."id" IS NULL
  `) {
    push(
      violations,
      row.owner_mismatch ? "CALENDAR_OWNER_MISMATCH" : "CALENDAR_INTEGRATION_MISSING",
      "calendar_events",
      row.id,
      stop
    );
  }

  collectWidgetViolations(
    await prisma.$queryRaw<WidgetRow[]>`
      SELECT "id"::text AS id,
             "user_id"::text AS user_id,
             "widget_type"::text AS widget_type,
             "position"
      FROM "widget_preferences"
    `,
    violations,
    stop
  );

  for (const row of await prisma.$queryRaw<DatedRow[]>`
    SELECT "id"::text AS id, "created_at", "delete_at"
    FROM "notification_deliveries"
  `) {
    const code = deliveryRetentionViolation(asDate(row.created_at), asDate(row.delete_at));

    if (code) {
      push(violations, code, "notification_deliveries", row.id, stop);
    }
  }

  for (const row of await prisma.$queryRaw<AuditRow[]>`
    SELECT "id"::text AS id, "user_id"::text AS user_id, "action"::text AS action, "created_at", "delete_at"
    FROM "audit_events"
  `) {
    if (row.user_id === null && row.action !== "account_deleted") {
      push(violations, "AUDIT_ANONYMOUS_ACTION", "audit_events", row.id, stop);
    }

    const code = auditRetentionViolation(asDate(row.created_at), asDate(row.delete_at));

    if (code) {
      push(violations, code, "audit_events", row.id, stop);
    }
  }

  const indexes = new Set(
    (
      await prisma.$queryRaw<Array<{ index_name: string }>>`
        SELECT indexname AS index_name FROM pg_indexes WHERE schemaname = 'public'
      `
    ).map((row) => row.index_name)
  );

  for (const index of ALL_PARTIAL_INDEXES) {
    if (!indexes.has(index.name)) {
      push(violations, "PARTIAL_INDEX_MISSING", index.table, index.name, stop);
    }
  }

  const constraints = await prisma.$queryRaw<ConstraintRow[]>`
    SELECT con.conname AS name, pg_get_constraintdef(con.oid) AS definition
    FROM pg_constraint con
    JOIN pg_namespace n ON n.oid = con.connamespace
    WHERE n.nspname = 'public' AND con.contype IN ('f', 'c')
  `;
  const byName = new Map(constraints.map((row) => [row.name, row.definition ?? ""]));

  for (const name of FOREIGN_KEYS) {
    if (!byName.get(name)?.includes("ON DELETE CASCADE")) {
      push(violations, "FOREIGN_KEY_MISSING", "pg_constraint", name, stop);
    }
  }

  for (const check of CIPHERTEXT_CHECKS) {
    if (!byName.has(check.name)) {
      push(violations, "CIPHERTEXT_CHECK_MISSING", check.table, check.name, stop);
    }
  }

  for (const row of await prisma.$queryRaw<ForeignKeyColumnRow[]>(
    Prisma.raw(UNINDEXED_FOREIGN_KEY_SQL)
  )) {
    push(
      violations,
      "UNINDEXED_FOREIGN_KEY",
      row.table_name ?? "pg_constraint",
      row.column_name,
      stop
    );
  }

  return {
    ok: violations.length === 0,
    violations,
    truncated
  };
}

export function integrityStatementText(): readonly string[] {
  return [
    ...USER_TABLES.map((table) => orphanSql(table).text),
    `SELECT "id"::text AS id, "user_id"::text AS user_id, "widget_type"::text AS widget_type, "position" FROM "widget_preferences"`,
    `SELECT "id"::text AS id, "created_at", "delete_at" FROM "notification_deliveries"`,
    `SELECT "id"::text AS id, "user_id"::text AS user_id, "action"::text AS action, "created_at", "delete_at" FROM "audit_events"`,
    UNINDEXED_FOREIGN_KEY_SQL
  ];
}

export function collectWidgetViolations(
  rows: readonly WidgetRow[],
  violations: IntegrityViolation[] = [],
  stop: () => void = () => undefined
): readonly IntegrityViolation[] {
  const seenTypes = new Map<string, string>();
  const seenPositions = new Map<string, string>();

  for (const row of rows) {
    if (!row.id || !row.user_id || !row.widget_type || typeof row.position !== "number") {
      continue;
    }

    const typeKey = `${row.user_id}\0${row.widget_type}`;
    const previousType = seenTypes.get(typeKey);

    if (previousType) {
      push(violations, "DUPLICATE_WIDGET", "widget_preferences", row.id, stop);
    } else {
      seenTypes.set(typeKey, row.id);
    }

    const positionKey = `${row.user_id}\0${String(row.position)}`;
    const previousPosition = seenPositions.get(positionKey);

    if (previousPosition) {
      push(violations, "DUPLICATE_WIDGET_POSITION", "widget_preferences", row.id, stop);
    } else {
      seenPositions.set(positionKey, row.id);
    }
  }

  return violations;
}

function orphanSql(table: (typeof USER_TABLES)[number]): Prisma.Sql {
  if (!USER_TABLES.includes(table)) {
    throw new Error(`Неизвестная таблица проверки целостности: ${table}`);
  }

  return Prisma.sql`
    SELECT t."id"::text AS id
    FROM ${Prisma.raw(`"${table}"`)} t
    LEFT JOIN "users" u ON u."id" = t."user_id"
    WHERE t."user_id" IS NOT NULL AND u."id" IS NULL
  `;
}

function push(
  violations: IntegrityViolation[],
  code: IntegrityCode,
  collection: string,
  documentId: string | null,
  stop: () => void
): void {
  if (violations.length >= MAX_VIOLATIONS) {
    stop();
    return;
  }

  violations.push({
    code,
    collection,
    documentId: documentId && documentId.length > 0 ? documentId : "unknown"
  });
}

function asDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}
