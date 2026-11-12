import type { CollectionName } from "./collection-catalog.js";

export type IndexKind = "unique" | "ttl" | "query";

export type PartialFilter = { readonly deletedAt: null } | { readonly completedAt: null };

type IndexBase = {
  readonly collection: CollectionName;
  readonly name: string;
  readonly key: Readonly<Record<string, 1 | -1>>;
};

export type IndexDefinition = IndexBase &
  (
    | {
        readonly kind: "unique";
        readonly unique: true;
        readonly partialFilterExpression?: PartialFilter;
      }
    | {
        readonly kind: "ttl";
        readonly expireAfterSeconds: 0;
      }
    | {
        readonly kind: "query";
        readonly partialFilterExpression?: PartialFilter;
      }
  );

const ACTIVE = { deletedAt: null } as const;
const OPEN_TIMER = { completedAt: null } as const;

function uniqueIndex(
  collection: CollectionName,
  name: string,
  key: Readonly<Record<string, 1 | -1>>,
  partialFilterExpression?: PartialFilter
): IndexDefinition {
  if (partialFilterExpression) {
    return { collection, name, kind: "unique", key, unique: true, partialFilterExpression };
  }

  return { collection, name, kind: "unique", key, unique: true };
}

function queryIndex(
  collection: CollectionName,
  name: string,
  key: Readonly<Record<string, 1 | -1>>,
  partialFilterExpression?: PartialFilter
): IndexDefinition {
  if (partialFilterExpression) {
    return { collection, name, kind: "query", key, partialFilterExpression };
  }

  return { collection, name, kind: "query", key };
}

function ttlIndex(collection: CollectionName, name: string, field: string): IndexDefinition {
  const key: Record<string, 1 | -1> = {};
  key[field] = 1;

  return {
    collection,
    name,
    kind: "ttl",
    key,
    expireAfterSeconds: 0
  };
}

export const INDEX_DEFINITIONS: readonly IndexDefinition[] = [
  uniqueIndex("auth_accounts", "auth_accounts_provider_identity", {
    provider: 1,
    providerUserId: 1
  }),
  uniqueIndex("auth_accounts", "auth_accounts_user_provider", { userId: 1, provider: 1 }),
  uniqueIndex("sessions", "sessions_token_hash", { tokenHash: 1 }),
  ttlIndex("sessions", "sessions_expires_at", "expiresAt"),
  uniqueIndex("one_time_tokens", "one_time_tokens_token_hash", { tokenHash: 1 }),
  ttlIndex("one_time_tokens", "one_time_tokens_expires_at", "expiresAt"),
  uniqueIndex("dashboard_configs", "dashboard_configs_user", { userId: 1 }),
  queryIndex("routine_rules", "routine_rules_user_status", { userId: 1, status: 1 }, ACTIVE),
  queryIndex("routine_rules", "routine_rules_user_start_date", { userId: 1, startDate: 1 }, ACTIVE),
  uniqueIndex("routine_occurrences", "routine_occurrences_rule_date", {
    routineRuleId: 1,
    localDate: 1
  }),
  queryIndex("routine_occurrences", "routine_occurrences_user_date", { userId: 1, localDate: 1 }),
  queryIndex("timer_sessions", "timer_sessions_user_started_at", { userId: 1, startedAt: -1 }),
  uniqueIndex("timer_sessions", "timer_sessions_one_active_user", { userId: 1 }, OPEN_TIMER),
  uniqueIndex("integrations", "integrations_user_type", { userId: 1, type: 1 }, ACTIVE),
  uniqueIndex("calendar_events", "calendar_events_integration_external", {
    integrationId: 1,
    externalEventId: 1
  }),
  queryIndex("calendar_events", "calendar_events_user_start", { userId: 1, startAt: 1 }),
  uniqueIndex("news_items", "news_items_content_hash", { contentHash: 1 }),
  queryIndex("news_items", "news_items_published_topics_language", {
    publishedAt: -1,
    topics: 1,
    language: 1
  }),
  uniqueIndex("push_subscriptions", "push_subscriptions_endpoint_hash", { endpointHash: 1 }),
  queryIndex("push_subscriptions", "push_subscriptions_user_revoked", { userId: 1, revokedAt: 1 }),
  uniqueIndex("notification_deliveries", "notification_deliveries_idempotency_key", {
    idempotencyKey: 1
  }),
  queryIndex("notification_deliveries", "notification_deliveries_user_created", {
    userId: 1,
    createdAt: -1
  }),
  ttlIndex("notification_deliveries", "notification_deliveries_delete_at", "deleteAt"),
  uniqueIndex("scheduled_jobs", "scheduled_jobs_idempotency_key", { idempotencyKey: 1 }),
  queryIndex("scheduled_jobs", "scheduled_jobs_status_run_at", { status: 1, runAt: 1 }),
  queryIndex("scheduled_jobs", "scheduled_jobs_status_lock", { status: 1, lockExpiresAt: 1 }),
  queryIndex("scheduled_jobs", "scheduled_jobs_user_status", { userId: 1, status: 1 }),
  queryIndex("scheduled_jobs", "scheduled_jobs_type_updated", { type: 1, updatedAt: -1 }),
  ttlIndex("scheduled_jobs", "scheduled_jobs_delete_at", "deleteAt"),
  queryIndex("timer_sessions", "timer_sessions_due", { endsAt: 1 }, OPEN_TIMER),
  queryIndex(
    "routine_rules",
    "routine_rules_status_reminder",
    { status: 1, reminderLocalTime: 1 },
    ACTIVE
  ),
  queryIndex("push_subscriptions", "push_subscriptions_revoked_at", { revokedAt: 1 }),
  queryIndex("integrations", "integrations_type_status", { type: 1, status: 1 }, ACTIVE)
];

const TTL_FIELDS: Readonly<Record<string, string>> = {
  sessions: "expiresAt",
  one_time_tokens: "expiresAt",
  notification_deliveries: "deleteAt",
  scheduled_jobs: "deleteAt"
};

export function assertIndexCatalog(indexes: readonly IndexDefinition[] = INDEX_DEFINITIONS): void {
  const names = new Set<string>();
  const ttlFields = new Map<string, string>();

  for (const index of indexes) {
    if (index.collection === "users") {
      throw new Error("Внешние идентификаторы пользователя не индексируются в users");
    }

    if (names.has(index.name) || index.name.length === 0 || index.name.length > 64) {
      throw new Error(`Некорректное имя индекса: ${index.name}`);
    }

    names.add(index.name);

    if (Object.keys(index.key).length === 0) {
      throw new Error(`Пустой ключ индекса: ${index.name}`);
    }

    if (index.kind === "ttl") {
      const entry = Object.entries(index.key);
      const field = entry[0]?.[0];
      const direction = entry[0]?.[1];

      if (
        entry.length !== 1 ||
        field === undefined ||
        direction !== 1 ||
        index.expireAfterSeconds !== 0
      ) {
        throw new Error(`TTL-индекс ${index.name} должен быть однопольным с expireAfterSeconds 0`);
      }

      if (TTL_FIELDS[index.collection] !== field) {
        throw new Error(`TTL-индекс не предусмотрен для ${index.collection}.${field}`);
      }

      ttlFields.set(index.collection, field);
    }
  }

  for (const [collection, field] of Object.entries(TTL_FIELDS)) {
    if (ttlFields.get(collection) !== field) {
      throw new Error(`Не найден TTL-индекс ${collection}.${field}`);
    }
  }
}
