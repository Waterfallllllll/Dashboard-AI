// Сроки хранения PostgreSQL. У сервера нет TTL-индексов: просроченные строки
// удаляет worker по этим полям. История таймера, рутин и календаря живёт до очистки аккаунта.

export const DEFAULT_NOTIFICATION_RETENTION_DAYS = 30;
export const DEFAULT_AUDIT_RETENTION_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RETENTION_DAYS = 3650;

export const WORKER_DELETE_POLICIES = [
  {
    table: "sessions",
    column: "expires_at",
    index: "sessions_expires_at",
    mode: "timestamp"
  },
  {
    table: "one_time_tokens",
    column: "expires_at",
    index: "one_time_tokens_expires_at",
    mode: "timestamp"
  },
  {
    table: "notification_deliveries",
    column: "delete_at",
    index: "notification_deliveries_delete_at",
    mode: "days",
    days: DEFAULT_NOTIFICATION_RETENTION_DAYS
  },
  {
    table: "audit_events",
    column: "delete_at",
    index: "audit_events_delete_at",
    mode: "days",
    days: DEFAULT_AUDIT_RETENTION_DAYS
  },
  {
    table: "scheduled_jobs",
    column: "delete_at",
    index: "scheduled_jobs_delete_at",
    mode: "timestamp"
  }
] as const;

export const UNTIL_ACCOUNT_PURGE = [
  "timer_presets",
  "timer_sessions",
  "routine_rules",
  "routine_occurrences",
  "calendar_events"
] as const;

export type WorkerDeletePolicy = (typeof WORKER_DELETE_POLICIES)[number];

export type DeliveryRetentionCode = "DELIVERY_WITHOUT_EXPIRY" | "DELIVERY_EXPIRY_OUT_OF_POLICY";

export type AuditRetentionCode = "AUDIT_WITHOUT_EXPIRY" | "AUDIT_EXPIRY_OUT_OF_POLICY";

export function notificationDeleteAt(
  createdAt: Date,
  retentionDays = DEFAULT_NOTIFICATION_RETENTION_DAYS
): Date {
  return addRetentionDays(
    createdAt,
    retentionDays,
    "Срок хранения уведомлений",
    "создания уведомления"
  );
}

export function auditDeleteAt(createdAt: Date, retentionDays = DEFAULT_AUDIT_RETENTION_DAYS): Date {
  return addRetentionDays(createdAt, retentionDays, "Срок хранения аудита", "события аудита");
}

export function deliveryRetentionViolation(
  createdAt: Date | null,
  deleteAt: Date | null
): DeliveryRetentionCode | null {
  return retentionViolation(
    createdAt,
    deleteAt,
    notificationDeleteAt,
    "DELIVERY_WITHOUT_EXPIRY",
    "DELIVERY_EXPIRY_OUT_OF_POLICY"
  );
}

export function auditRetentionViolation(
  createdAt: Date | null,
  deleteAt: Date | null
): AuditRetentionCode | null {
  return retentionViolation(
    createdAt,
    deleteAt,
    auditDeleteAt,
    "AUDIT_WITHOUT_EXPIRY",
    "AUDIT_EXPIRY_OUT_OF_POLICY"
  );
}

export function assertRetentionPolicy(indexNames: readonly string[]): void {
  const indexes = new Set(indexNames);
  const keptUntilPurge = new Set<string>(UNTIL_ACCOUNT_PURGE);
  const tables = new Set<string>();

  for (const policy of WORKER_DELETE_POLICIES) {
    if (keptUntilPurge.has(policy.table)) {
      throw new Error(`${policy.table} хранится до очистки аккаунта и не удаляется по сроку`);
    }

    if (tables.has(policy.table)) {
      throw new Error(`У ${policy.table} больше одного правила удаления`);
    }

    tables.add(policy.table);

    if (!indexes.has(policy.index)) {
      throw new Error(`Для ${policy.table} нет индекса ${policy.index}`);
    }
  }
}

export function assertNoTtlSyntax(sql: string): void {
  if (/expireafterseconds/i.test(sql) || /\bttl\b/i.test(sql)) {
    throw new Error("У PostgreSQL нет TTL-индексов: просроченные строки удаляет worker");
  }
}

function addRetentionDays(
  createdAt: Date,
  retentionDays: number,
  label: string,
  subject: string
): Date {
  if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > MAX_RETENTION_DAYS) {
    throw new Error(`${label} должен быть целым числом дней от 1 до 3650`);
  }

  const createdAtMs = createdAt.getTime();

  if (Number.isNaN(createdAtMs)) {
    throw new Error(`Некорректная дата ${subject}`);
  }

  return new Date(createdAtMs + retentionDays * DAY_MS);
}

function retentionViolation<Code extends string>(
  createdAt: Date | null,
  deleteAt: Date | null,
  expected: (createdAt: Date) => Date,
  missing: Code,
  invalid: Code
): Code | null {
  if (!(createdAt instanceof Date) || Number.isNaN(createdAt.getTime())) {
    return invalid;
  }

  if (!(deleteAt instanceof Date) || Number.isNaN(deleteAt.getTime())) {
    return missing;
  }

  if (deleteAt.getTime() !== expected(createdAt).getTime()) {
    return invalid;
  }

  return null;
}
