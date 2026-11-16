import { randomUUID } from "node:crypto";

import { Prisma } from "../../generated/prisma/client.js";

import {
  ALL_PARTIAL_INDEXES,
  FOREIGN_KEY_INDEXES,
  QUERY_INDEXES,
  UNIQUE_INDEXES
} from "./migration-catalog.js";
import { prepareRoutineReminderSample, prepareRoutineStatusSample } from "./routine-plan-sample.js";
import { WORKER_DELETE_POLICIES, assertRetentionPolicy } from "./retention.js";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export const QUERY_TABLES = [
  "auth_accounts",
  "sessions",
  "one_time_tokens",
  "widget_preferences",
  "routine_rules",
  "routine_occurrences",
  "timer_presets",
  "timer_sessions",
  "integrations",
  "calendar_events",
  "news_items",
  "push_subscriptions",
  "scheduled_jobs",
  "notification_deliveries",
  "audit_events"
] as const;

const ORDER_BY = new Set([
  '"started_at" DESC',
  '"reminder_local_time"',
  '"published_at" DESC',
  '"start_at"',
  '"created_at" DESC',
  '"updated_at" DESC',
  '"run_at"',
  '"lock_expires_at"'
]);

const SECRET_COLUMNS = [
  '"access_token"',
  '"refresh_token"',
  '"credentials"',
  '"payload"',
  '"keys"',
  '"endpoint"'
] as const;

export type QuerySample = {
  readonly userId: string;
  readonly otherId: string;
  readonly localDate: string;
  readonly tokenHash: string;
  readonly providerUserId: string;
  readonly contentHash: string;
  readonly endpointHash: string;
  readonly idempotencyKey: string;
  readonly moment: Date;
  readonly externalEventId: string;
  readonly position: number;
};

export type QueryStatementClient = Prisma.TransactionClient;

export type MainQuery = {
  readonly name: string;
  readonly table: (typeof QUERY_TABLES)[number];
  readonly indexName: string;
  readonly indexProvidesOrder: boolean;
  readonly requiredSql: readonly string[];
  readonly statement: (sample: QuerySample) => Prisma.Sql;
  readonly prepare?: (tx: QueryStatementClient, sample: QuerySample) => Promise<void>;
};

type SelectOptions = {
  readonly orderBy?: string;
  readonly limit?: number;
};

export function createQuerySample(): QuerySample {
  return {
    userId: randomUUID(),
    otherId: randomUUID(),
    localDate: "2026-11-15",
    tokenHash: "a".repeat(64),
    providerUserId: "google-user",
    contentHash: "b".repeat(64),
    endpointHash: "c".repeat(64),
    idempotencyKey: "timer:sample:work-completed:telegram",
    moment: new Date("2026-11-15T12:00:00.000Z"),
    externalEventId: "event-1",
    position: 1
  };
}

export function buildMainQueries(sample: QuerySample): readonly MainQuery[] {
  if (!DAY.test(sample.localDate)) {
    throw new Error("Локальная дата запроса должна быть в формате YYYY-MM-DD");
  }

  return [
    query("auth-by-provider-identity", "auth_accounts", "auth_accounts_provider_identity", {
      requiredSql: ['"provider"', '"provider_user_id"'],
      statement: (value) =>
        selectWhere(
          "auth_accounts",
          Prisma.sql`"provider" = 'google'::"auth_provider" AND "provider_user_id" = ${value.providerUserId}`
        )
    }),
    query("auth-by-user-provider", "auth_accounts", "auth_accounts_user_provider", {
      requiredSql: ['"user_id"', '"provider"'],
      statement: (value) =>
        selectWhere(
          "auth_accounts",
          Prisma.sql`"user_id" = ${value.userId}::uuid AND "provider" = 'google'::"auth_provider"`
        )
    }),
    query("session-by-token-hash", "sessions", "sessions_token_hash", {
      requiredSql: ['"token_hash"'],
      statement: (value) => selectWhere("sessions", Prisma.sql`"token_hash" = ${value.tokenHash}`)
    }),
    query("session-expired", "sessions", "sessions_expires_at", {
      requiredSql: ['"expires_at" <='],
      statement: (value) => selectWhere("sessions", Prisma.sql`"expires_at" <= ${value.moment}`)
    }),
    query("sessions-by-user", "sessions", "sessions_user_id", {
      requiredSql: ['"user_id"'],
      statement: (value) => selectWhere("sessions", Prisma.sql`"user_id" = ${value.userId}::uuid`)
    }),
    query("oauth-state-by-hash", "one_time_tokens", "one_time_tokens_token_hash", {
      requiredSql: ['"token_hash"'],
      statement: (value) =>
        selectWhere("one_time_tokens", Prisma.sql`"token_hash" = ${value.tokenHash}`)
    }),
    query("oauth-state-expired", "one_time_tokens", "one_time_tokens_expires_at", {
      requiredSql: ['"expires_at" <='],
      statement: (value) =>
        selectWhere("one_time_tokens", Prisma.sql`"expires_at" <= ${value.moment}`)
    }),
    query("widget-by-type", "widget_preferences", "widget_preferences_user_type", {
      requiredSql: ['"user_id"', '"widget_type"'],
      statement: (value) =>
        selectWhere(
          "widget_preferences",
          Prisma.sql`"user_id" = ${value.userId}::uuid AND "widget_type" = 'news'::"widget_type"`
        )
    }),
    query("widget-by-position", "widget_preferences", "widget_preferences_user_position", {
      requiredSql: ['"user_id"', '"position"'],
      statement: (value) =>
        selectWhere(
          "widget_preferences",
          Prisma.sql`"user_id" = ${value.userId}::uuid AND "position" = ${value.position}`
        )
    }),
    query("routine-by-id", "routine_rules", "routine_rules_id_user", {
      requiredSql: ['"id"', '"user_id"'],
      statement: (value) =>
        selectWhere(
          "routine_rules",
          Prisma.sql`"id" = ${value.otherId}::uuid AND "user_id" = ${value.userId}::uuid`
        )
    }),
    query("routines-by-user-status", "routine_rules", "routine_rules_user_status", {
      requiredSql: ['"user_id"', '"status"', '"deleted_at" IS NULL'],
      prepare: (tx, value) => prepareRoutineStatusSample(tx, value.userId),
      statement: (value) =>
        selectWhere(
          "routine_rules",
          Prisma.sql`"user_id" = ${value.userId}::uuid AND "status" = 'active'::"routine_status" AND "deleted_at" IS NULL`
        )
    }),
    query("routines-by-user-start-date", "routine_rules", "routine_rules_user_start_date", {
      requiredSql: ['"user_id"', '"start_date"', '"deleted_at" IS NULL'],
      statement: (value) =>
        selectWhere(
          "routine_rules",
          Prisma.sql`"user_id" = ${value.userId}::uuid AND "start_date" = ${value.localDate}::date AND "deleted_at" IS NULL`
        )
    }),
    query("routines-active-reminders", "routine_rules", "routine_rules_active_reminders", {
      requiredSql: [
        `"status" = 'active'`,
        '"deleted_at" IS NULL',
        '"reminder_local_time" IS NOT NULL',
        'ORDER BY "reminder_local_time"'
      ],
      indexProvidesOrder: true,
      prepare: (tx, value) => prepareRoutineReminderSample(tx, value.userId),
      statement: (value) => {
        void value.localDate;

        return selectWhere(
          "routine_rules",
          Prisma.sql`"status" = 'active'::"routine_status" AND "deleted_at" IS NULL AND "reminder_local_time" IS NOT NULL`,
          { orderBy: '"reminder_local_time"', limit: 20 }
        );
      }
    }),
    query("occurrence-by-rule-date", "routine_occurrences", "routine_occurrences_rule_date", {
      requiredSql: ['"routine_rule_id"', '"local_date"'],
      statement: (value) =>
        selectWhere(
          "routine_occurrences",
          Prisma.sql`"routine_rule_id" = ${value.otherId}::uuid AND "local_date" = ${value.localDate}::date`
        )
    }),
    query("occurrences-by-user-date", "routine_occurrences", "routine_occurrences_user_date", {
      requiredSql: ['"user_id"', '"local_date"'],
      statement: (value) =>
        selectWhere(
          "routine_occurrences",
          Prisma.sql`"user_id" = ${value.userId}::uuid AND "local_date" = ${value.localDate}::date`
        )
    }),
    query("timer-preset", "timer_presets", "timer_presets_user", {
      requiredSql: ['"user_id"'],
      statement: (value) =>
        selectWhere("timer_presets", Prisma.sql`"user_id" = ${value.userId}::uuid`)
    }),
    query("timer-history", "timer_sessions", "timer_sessions_user_started_at", {
      requiredSql: ['"user_id"', 'ORDER BY "started_at" DESC'],
      indexProvidesOrder: true,
      statement: (value) =>
        selectWhere("timer_sessions", Prisma.sql`"user_id" = ${value.userId}::uuid`, {
          orderBy: '"started_at" DESC',
          limit: 20
        })
    }),
    query("timer-active", "timer_sessions", "timer_sessions_one_active_user", {
      requiredSql: ['"user_id"', '"completed_at" IS NULL'],
      statement: (value) =>
        selectWhere(
          "timer_sessions",
          Prisma.sql`"user_id" = ${value.userId}::uuid AND "completed_at" IS NULL`
        )
    }),
    query("integration-by-id", "integrations", "integrations_id_user", {
      requiredSql: ['"id"', '"user_id"'],
      statement: (value) =>
        selectWhere(
          "integrations",
          Prisma.sql`"id" = ${value.otherId}::uuid AND "user_id" = ${value.userId}::uuid`
        )
    }),
    query("integration-by-user-type", "integrations", "integrations_user_type", {
      requiredSql: ['"user_id"', '"type"', '"deleted_at" IS NULL'],
      statement: (value) =>
        selectWhere(
          "integrations",
          Prisma.sql`"user_id" = ${value.userId}::uuid AND "type" = 'google_calendar'::"integration_type" AND "deleted_at" IS NULL`
        )
    }),
    query(
      "calendar-event-by-external-id",
      "calendar_events",
      "calendar_events_integration_external",
      {
        requiredSql: ['"integration_id"', '"external_event_id"'],
        statement: (value) =>
          selectWhere(
            "calendar_events",
            Prisma.sql`"integration_id" = ${value.otherId}::uuid AND "external_event_id" = ${value.externalEventId}`
          )
      }
    ),
    query("calendar-by-user-start", "calendar_events", "calendar_events_user_start", {
      requiredSql: ['"user_id"', '"start_at" >=', 'ORDER BY "start_at"'],
      indexProvidesOrder: true,
      statement: (value) =>
        selectWhere(
          "calendar_events",
          Prisma.sql`"user_id" = ${value.userId}::uuid AND "start_at" >= ${value.moment}`,
          { orderBy: '"start_at"', limit: 20 }
        )
    }),
    query("news-by-content-hash", "news_items", "news_items_content_hash", {
      requiredSql: ['"content_hash"'],
      statement: (value) =>
        selectWhere("news_items", Prisma.sql`"content_hash" = ${value.contentHash}`)
    }),
    query("news-feed", "news_items", "news_items_published_language", {
      requiredSql: ['"published_at" <=', '"language"', 'ORDER BY "published_at" DESC'],
      indexProvidesOrder: true,
      statement: (value) =>
        selectWhere(
          "news_items",
          Prisma.sql`"published_at" <= ${value.moment} AND "language" = 'ru'`,
          { orderBy: '"published_at" DESC', limit: 20 }
        )
    }),
    query("news-by-topic", "news_items", "news_items_topics", {
      requiredSql: ['"topics" @>'],
      statement: () => selectWhere("news_items", Prisma.sql`"topics" @> ARRAY['focus']::text[]`)
    }),
    query("push-by-endpoint-hash", "push_subscriptions", "push_subscriptions_endpoint_hash", {
      requiredSql: ['"endpoint_hash"'],
      statement: (value) =>
        selectWhere("push_subscriptions", Prisma.sql`"endpoint_hash" = ${value.endpointHash}`)
    }),
    query("push-by-user-revoked", "push_subscriptions", "push_subscriptions_user_revoked", {
      requiredSql: ['"user_id"', '"revoked_at" IS NOT NULL'],
      statement: (value) =>
        selectWhere(
          "push_subscriptions",
          Prisma.sql`"user_id" = ${value.userId}::uuid AND "revoked_at" IS NOT NULL`
        )
    }),
    query("push-revoked", "push_subscriptions", "push_subscriptions_revoked_at", {
      requiredSql: ['"revoked_at" <='],
      statement: (value) =>
        selectWhere("push_subscriptions", Prisma.sql`"revoked_at" <= ${value.moment}`)
    }),
    query("job-by-idempotency-key", "scheduled_jobs", "scheduled_jobs_idempotency_key", {
      requiredSql: ['"idempotency_key"'],
      statement: (value) =>
        selectWhere("scheduled_jobs", Prisma.sql`"idempotency_key" = ${value.idempotencyKey}`)
    }),
    query("jobs-by-status-run-at", "scheduled_jobs", "scheduled_jobs_status_run_at", {
      requiredSql: [`"status" = 'completed'`, '"run_at" <=', 'ORDER BY "run_at"'],
      indexProvidesOrder: true,
      statement: (value) =>
        selectWhere(
          "scheduled_jobs",
          Prisma.sql`"status" = 'completed'::"job_status" AND "run_at" <= ${value.moment}`,
          { orderBy: '"run_at"', limit: 20 }
        )
    }),
    query("jobs-expired-lease", "scheduled_jobs", "scheduled_jobs_status_lock", {
      requiredSql: [
        `"status" = 'processing'`,
        '"lock_expires_at" <=',
        'ORDER BY "lock_expires_at"'
      ],
      indexProvidesOrder: true,
      statement: (value) =>
        selectWhere(
          "scheduled_jobs",
          Prisma.sql`"status" = 'processing'::"job_status" AND "lock_expires_at" <= ${value.moment}`,
          { orderBy: '"lock_expires_at"', limit: 20 }
        )
    }),
    query("jobs-by-user", "scheduled_jobs", "scheduled_jobs_user_status", {
      requiredSql: ['"user_id"', `"status" = 'failed'`],
      statement: (value) =>
        selectWhere(
          "scheduled_jobs",
          Prisma.sql`"user_id" = ${value.userId}::uuid AND "status" = 'failed'::"job_status"`
        )
    }),
    query("worker-heartbeat", "scheduled_jobs", "scheduled_jobs_type_updated", {
      requiredSql: ['"type"', 'ORDER BY "updated_at" DESC'],
      indexProvidesOrder: true,
      statement: () =>
        selectWhere(
          "scheduled_jobs",
          Prisma.sql`"type" = 'worker-heartbeat'::"scheduled_job_type"`,
          { orderBy: '"updated_at" DESC', limit: 1 }
        )
    }),
    query("jobs-expired", "scheduled_jobs", "scheduled_jobs_delete_at", {
      requiredSql: ['"delete_at" <='],
      statement: (value) =>
        selectWhere("scheduled_jobs", Prisma.sql`"delete_at" <= ${value.moment}`)
    }),
    query("jobs-ready", "scheduled_jobs", "scheduled_jobs_pending_run_at", {
      // Литерал pending нужен, чтобы частичный индекс подошёл. Параметр планировщик не считает константой.
      requiredSql: [`"status" = 'pending'`, '"run_at" <=', 'ORDER BY "run_at"'],
      indexProvidesOrder: true,
      statement: (value) =>
        selectWhere(
          "scheduled_jobs",
          Prisma.sql`"status" = 'pending'::"job_status" AND "run_at" <= ${value.moment}`,
          { orderBy: '"run_at"', limit: 1 }
        )
    }),
    query(
      "delivery-by-idempotency-key",
      "notification_deliveries",
      "notification_deliveries_idempotency_key",
      {
        requiredSql: ['"idempotency_key"'],
        statement: (value) =>
          selectWhere(
            "notification_deliveries",
            Prisma.sql`"idempotency_key" = ${value.idempotencyKey}`
          )
      }
    ),
    query("deliveries-by-user", "notification_deliveries", "notification_deliveries_user_created", {
      requiredSql: ['"user_id"', 'ORDER BY "created_at" DESC'],
      indexProvidesOrder: true,
      statement: (value) =>
        selectWhere("notification_deliveries", Prisma.sql`"user_id" = ${value.userId}::uuid`, {
          orderBy: '"created_at" DESC',
          limit: 20
        })
    }),
    query("deliveries-expired", "notification_deliveries", "notification_deliveries_delete_at", {
      requiredSql: ['"delete_at" <='],
      statement: (value) =>
        selectWhere("notification_deliveries", Prisma.sql`"delete_at" <= ${value.moment}`)
    }),
    query("audit-by-user", "audit_events", "audit_events_user_created", {
      requiredSql: ['"user_id"', 'ORDER BY "created_at" DESC'],
      indexProvidesOrder: true,
      statement: (value) =>
        selectWhere("audit_events", Prisma.sql`"user_id" = ${value.userId}::uuid`, {
          orderBy: '"created_at" DESC',
          limit: 50
        })
    }),
    query("audit-expired", "audit_events", "audit_events_delete_at", {
      requiredSql: ['"delete_at" <='],
      statement: (value) => selectWhere("audit_events", Prisma.sql`"delete_at" <= ${value.moment}`)
    })
  ];
}

export function sqlText(statement: Prisma.Sql): string {
  return statement.text;
}

export function secretColumnInSql(sql: string): string | null {
  return SECRET_COLUMNS.find((column) => sql.includes(column)) ?? null;
}

export function assertQueryCatalog(sample: QuerySample = createQuerySample()): void {
  const queries = buildMainQueries(sample);
  const names = new Set<string>();
  const usedIndexes = new Set<string>();
  const expectedIndexes = new Set<string>([
    ...UNIQUE_INDEXES,
    ...QUERY_INDEXES,
    ...FOREIGN_KEY_INDEXES,
    ...ALL_PARTIAL_INDEXES.map((index) => index.name)
  ]);

  for (const item of queries) {
    if (names.has(item.name) || item.name.length === 0) {
      throw new Error(`Некорректное имя запроса: ${item.name}`);
    }

    names.add(item.name);

    if (!QUERY_TABLES.includes(item.table)) {
      throw new Error(`Запрос ${item.name} читает недопустимую таблицу`);
    }

    if (usedIndexes.has(item.indexName) || !expectedIndexes.has(item.indexName)) {
      throw new Error(`Запрос ${item.name} указывает на неверный индекс ${item.indexName}`);
    }

    usedIndexes.add(item.indexName);
    const text = sqlText(item.statement(sample));

    if (!text.includes('SELECT "id"') || text.includes("SELECT *")) {
      throw new Error(`Запрос ${item.name} должен читать только id`);
    }

    const secret = secretColumnInSql(text);

    if (secret) {
      throw new Error(`Запрос ${item.name} читает секретное поле ${secret}`);
    }

    for (const fragment of item.requiredSql) {
      if (!text.includes(fragment)) {
        throw new Error(`Запрос ${item.name} не содержит ${fragment}`);
      }
    }

    if (item.indexProvidesOrder !== text.includes("ORDER BY")) {
      throw new Error(`Запрос ${item.name} неверно описывает порядок индекса`);
    }
  }

  for (const indexName of expectedIndexes) {
    if (!usedIndexes.has(indexName)) {
      throw new Error(`Для индекса ${indexName} нет основного запроса`);
    }
  }

  for (const index of ALL_PARTIAL_INDEXES) {
    const item = queries.find((query) => query.indexName === index.name);
    const fragment = partialFragment(index.where);

    if (!item || !sqlText(item.statement(sample)).includes(fragment)) {
      throw new Error(`Запрос индекса ${index.name} не включает фильтр ${fragment}`);
    }
  }

  for (const policy of WORKER_DELETE_POLICIES) {
    const item = queries.find((query) => query.indexName === policy.index);

    if (!item || !sqlText(item.statement(sample)).includes("<=")) {
      throw new Error(`Для очистки ${policy.table} нет запроса по индексу ${policy.index}`);
    }
  }

  assertRetentionPolicy([...expectedIndexes]);
}

function partialFragment(where: string): string {
  if (where.includes("reminder_local_time")) {
    return '"reminder_local_time" IS NOT NULL';
  }

  if (where.includes("deleted_at")) {
    return '"deleted_at" IS NULL';
  }

  if (where.includes("completed_at")) {
    return '"completed_at" IS NULL';
  }

  if (where.includes("pending")) {
    return "'pending'";
  }

  throw new Error(`Неизвестный фильтр частичного индекса: ${where}`);
}

function query(
  name: string,
  table: MainQuery["table"],
  indexName: string,
  definition: Omit<MainQuery, "name" | "table" | "indexName" | "indexProvidesOrder"> & {
    readonly indexProvidesOrder?: boolean;
  }
): MainQuery {
  return {
    name,
    table,
    indexName,
    indexProvidesOrder: definition.indexProvidesOrder ?? false,
    requiredSql: definition.requiredSql,
    statement: definition.statement,
    ...(definition.prepare ? { prepare: definition.prepare } : {})
  };
}

function selectWhere(
  table: MainQuery["table"],
  where: Prisma.Sql,
  options?: SelectOptions
): Prisma.Sql {
  if (!QUERY_TABLES.includes(table)) {
    throw new Error(`Неизвестная таблица запроса: ${table}`);
  }

  const orderBy = options?.orderBy;

  if (orderBy !== undefined && !ORDER_BY.has(orderBy)) {
    throw new Error(`Неизвестная сортировка запроса: ${orderBy}`);
  }

  const limit = options?.limit;

  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 100)) {
    throw new Error("Некорректный limit запроса");
  }

  const order = orderBy === undefined ? Prisma.empty : Prisma.raw(` ORDER BY ${orderBy}`);
  const limited = limit === undefined ? Prisma.empty : Prisma.raw(` LIMIT ${String(limit)}`);

  return Prisma.sql`SELECT "id" FROM ${Prisma.raw(`"${table}"`)} WHERE ${where}${order}${limited}`;
}
