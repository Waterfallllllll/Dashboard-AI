// Каталог того, что Prisma Schema не выражает и что добавляет первая миграция.
// Следующий `prisma migrate dev` может предложить удалить эти индексы и CHECK.
// Такие команды из SQL убираются: они описывают живые строки и ciphertext.

export const INITIAL_MIGRATION = "20261114202100_initial";

const CIPHERTEXT_MATCH = String.raw`^enc:v1:[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{2,}$`;

export type PartialIndexDefinition = {
  readonly name: string;
  readonly table: string;
  readonly columns: readonly string[];
  readonly where: string;
  readonly unique: boolean;
};

export type CiphertextCheck = {
  readonly name: string;
  readonly table: string;
  readonly column: string;
  readonly nullable: boolean;
};

export const PARTIAL_INDEXES: readonly PartialIndexDefinition[] = [
  {
    name: "routine_rules_user_status",
    table: "routine_rules",
    columns: ["user_id", "status"],
    where: '"deleted_at" IS NULL',
    unique: false
  },
  {
    name: "routine_rules_user_start_date",
    table: "routine_rules",
    columns: ["user_id", "start_date"],
    where: '"deleted_at" IS NULL',
    unique: false
  },
  {
    name: "timer_sessions_one_active_user",
    table: "timer_sessions",
    columns: ["user_id"],
    where: '"completed_at" IS NULL',
    unique: true
  },
  {
    name: "integrations_user_type",
    table: "integrations",
    columns: ["user_id", "type"],
    where: '"deleted_at" IS NULL',
    unique: true
  },
  {
    name: "scheduled_jobs_pending_run_at",
    table: "scheduled_jobs",
    columns: ["run_at"],
    where: `"status" = 'pending'::"job_status"`,
    unique: false
  }
];

export const LATER_PARTIAL_INDEXES: readonly PartialIndexDefinition[] = [
  {
    name: "routine_rules_active_reminders",
    table: "routine_rules",
    columns: ["reminder_local_time"],
    where: `"deleted_at" IS NULL AND "status" = 'active'::"routine_status" AND "reminder_local_time" IS NOT NULL`,
    unique: false
  }
];

export const ALL_PARTIAL_INDEXES: readonly PartialIndexDefinition[] = [
  ...PARTIAL_INDEXES,
  ...LATER_PARTIAL_INDEXES
];

export const FOREIGN_KEY_INDEXES = ["sessions_user_id"] as const;

export const CIPHERTEXT_CHECKS: readonly CiphertextCheck[] = [
  {
    name: "auth_accounts_access_token_ciphertext",
    table: "auth_accounts",
    column: "access_token",
    nullable: true
  },
  {
    name: "auth_accounts_refresh_token_ciphertext",
    table: "auth_accounts",
    column: "refresh_token",
    nullable: true
  },
  {
    name: "integrations_credentials_ciphertext",
    table: "integrations",
    column: "credentials",
    nullable: true
  },
  {
    name: "push_subscriptions_keys_ciphertext",
    table: "push_subscriptions",
    column: "keys",
    nullable: false
  },
  {
    name: "one_time_tokens_payload_ciphertext",
    table: "one_time_tokens",
    column: "payload",
    nullable: false
  }
];

export const FOREIGN_KEYS = [
  "auth_accounts_user_id_fkey",
  "sessions_user_id_fkey",
  "widget_preferences_user_id_fkey",
  "routine_rules_user_id_fkey",
  "routine_occurrences_routine_rule_id_user_id_fkey",
  "timer_presets_user_id_fkey",
  "timer_sessions_user_id_fkey",
  "integrations_user_id_fkey",
  "calendar_events_integration_id_user_id_fkey",
  "push_subscriptions_user_id_fkey",
  "scheduled_jobs_user_id_fkey",
  "notification_deliveries_user_id_fkey",
  "audit_events_user_id_fkey"
] as const;

export const UNIQUE_INDEXES = [
  "auth_accounts_provider_identity",
  "auth_accounts_user_provider",
  "sessions_token_hash",
  "one_time_tokens_token_hash",
  "widget_preferences_user_type",
  "widget_preferences_user_position",
  "routine_rules_id_user",
  "routine_occurrences_rule_date",
  "timer_presets_user",
  "integrations_id_user",
  "calendar_events_integration_external",
  "news_items_content_hash",
  "push_subscriptions_endpoint_hash",
  "scheduled_jobs_idempotency_key",
  "notification_deliveries_idempotency_key"
] as const;

export const QUERY_INDEXES = [
  "sessions_expires_at",
  "one_time_tokens_expires_at",
  "routine_occurrences_user_date",
  "timer_sessions_user_started_at",
  "calendar_events_user_start",
  "news_items_published_language",
  "news_items_topics",
  "push_subscriptions_user_revoked",
  "push_subscriptions_revoked_at",
  "scheduled_jobs_status_run_at",
  "scheduled_jobs_status_lock",
  "scheduled_jobs_user_status",
  "scheduled_jobs_type_updated",
  "scheduled_jobs_delete_at",
  "notification_deliveries_user_created",
  "notification_deliveries_delete_at",
  "audit_events_user_created",
  "audit_events_delete_at"
] as const;

export const SOFT_DELETE_TABLES = ["users", "routine_rules", "integrations"] as const;

export function renderPartialIndex(index: PartialIndexDefinition): string {
  const unique = index.unique ? "UNIQUE " : "";
  const columns = index.columns.map((column) => `"${column}"`).join(", ");

  return `CREATE ${unique}INDEX "${index.name}" ON "${index.table}"(${columns}) WHERE ${index.where};`;
}

export function renderCiphertextCheck(check: CiphertextCheck): string {
  const column = `"${check.column}"`;
  const shape = `char_length(${column}) <= 8192 AND ${column} ~ '${CIPHERTEXT_MATCH}'`;
  const predicate = check.nullable ? `${column} IS NULL OR (${shape})` : shape;

  return `ALTER TABLE "${check.table}" ADD CONSTRAINT "${check.name}" CHECK (${predicate});`;
}

export function renderMigrationExtras(): string {
  const indexes = PARTIAL_INDEXES.map((index) => `-- PartialIndex\n${renderPartialIndex(index)}`);
  const checks = CIPHERTEXT_CHECKS.map(
    (check) => `-- CiphertextCheck\n${renderCiphertextCheck(check)}`
  );

  return `${[...indexes, ...checks].join("\n\n")}\n`;
}

export function unexpectedMigrationDrift(script: string): readonly string[] {
  const allowed = new Set<string>([
    ...ALL_PARTIAL_INDEXES.flatMap((index) => [
      `DROP INDEX "${index.name}"`,
      `DROP INDEX "public"."${index.name}"`
    ]),
    ...CIPHERTEXT_CHECKS.flatMap((check) => [
      `ALTER TABLE "${check.table}" DROP CONSTRAINT "${check.name}"`,
      `ALTER TABLE "public"."${check.table}" DROP CONSTRAINT "${check.name}"`
    ])
  ]);

  return script
    .split(";")
    .map((statement) =>
      statement
        .replace(/--[^\n]*/g, "")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter((statement) => statement.length > 0 && !allowed.has(statement));
}
