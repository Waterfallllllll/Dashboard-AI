import { ObjectId, type Document } from "mongodb";

import type { CollectionName } from "./collection-catalog.js";
import { INDEX_DEFINITIONS, type IndexDefinition } from "./index-catalog.js";

export type QuerySample = {
  readonly userId: ObjectId;
  readonly routineRuleId: ObjectId;
  readonly localDate: string;
  readonly tokenHash: string;
  readonly providerUserId: string;
  readonly contentHash: string;
  readonly endpointHash: string;
  readonly idempotencyKey: string;
  readonly publishedBefore: Date;
};

export type MainQuery = {
  readonly name: string;
  readonly collection: CollectionName;
  readonly indexName: string;
  readonly filter: Document;
  readonly sort?: Readonly<Record<string, 1 | -1>>;
  readonly limit?: number;
  readonly indexProvidesOrder: boolean;
};

const ACTIVE = { deletedAt: null } as const;

export function createQuerySample(
  userId = new ObjectId(),
  routineRuleId = new ObjectId()
): QuerySample {
  return {
    userId,
    routineRuleId,
    localDate: "2026-11-09",
    tokenHash: "a".repeat(64),
    providerUserId: "google-user",
    contentHash: "b".repeat(32),
    endpointHash: "c".repeat(64),
    idempotencyKey: "timer:sample:work-completed:telegram",
    publishedBefore: new Date("2026-11-09T12:00:00.000Z")
  };
}

export function buildMainQueries(sample: QuerySample): readonly MainQuery[] {
  return [
    {
      name: "auth-by-provider-identity",
      collection: "auth_accounts",
      indexName: "auth_accounts_provider_identity",
      filter: { provider: "google", providerUserId: sample.providerUserId },
      indexProvidesOrder: false
    },
    {
      name: "auth-by-user-provider",
      collection: "auth_accounts",
      indexName: "auth_accounts_user_provider",
      filter: { userId: sample.userId, provider: "google" },
      indexProvidesOrder: false
    },
    {
      name: "session-by-token-hash",
      collection: "sessions",
      indexName: "sessions_token_hash",
      filter: { tokenHash: sample.tokenHash },
      indexProvidesOrder: false
    },
    {
      name: "dashboard-by-user",
      collection: "dashboard_configs",
      indexName: "dashboard_configs_user",
      filter: { userId: sample.userId },
      indexProvidesOrder: false
    },
    {
      name: "routines-by-user-status",
      collection: "routine_rules",
      indexName: "routine_rules_user_status",
      filter: { userId: sample.userId, status: "active", ...ACTIVE },
      indexProvidesOrder: false
    },
    {
      name: "routines-by-user-start-date",
      collection: "routine_rules",
      indexName: "routine_rules_user_start_date",
      filter: { userId: sample.userId, ...ACTIVE, startDate: { $lte: sample.localDate } },
      indexProvidesOrder: false
    },
    {
      name: "occurrence-by-rule-date",
      collection: "routine_occurrences",
      indexName: "routine_occurrences_rule_date",
      filter: { routineRuleId: sample.routineRuleId, localDate: sample.localDate },
      indexProvidesOrder: false
    },
    {
      name: "occurrences-by-user-date",
      collection: "routine_occurrences",
      indexName: "routine_occurrences_user_date",
      filter: { userId: sample.userId, localDate: sample.localDate },
      indexProvidesOrder: false
    },
    {
      name: "timer-history",
      collection: "timer_sessions",
      indexName: "timer_sessions_user_started_at",
      filter: { userId: sample.userId },
      sort: { startedAt: -1 },
      limit: 20,
      indexProvidesOrder: true
    },
    {
      name: "timer-active",
      collection: "timer_sessions",
      indexName: "timer_sessions_one_active_user",
      filter: { userId: sample.userId, completedAt: null },
      indexProvidesOrder: false
    },
    {
      name: "integration-by-user-type",
      collection: "integrations",
      indexName: "integrations_user_type",
      filter: { userId: sample.userId, type: "google_calendar", ...ACTIVE },
      indexProvidesOrder: false
    },
    {
      name: "news-by-content-hash",
      collection: "news_items",
      indexName: "news_items_content_hash",
      filter: { contentHash: sample.contentHash },
      indexProvidesOrder: false
    },
    {
      name: "news-feed",
      collection: "news_items",
      indexName: "news_items_published_topics_language",
      filter: {
        publishedAt: { $lte: sample.publishedBefore },
        topics: "focus",
        language: "ru"
      },
      sort: { publishedAt: -1 },
      limit: 20,
      indexProvidesOrder: true
    },
    {
      name: "push-by-endpoint-hash",
      collection: "push_subscriptions",
      indexName: "push_subscriptions_endpoint_hash",
      filter: { endpointHash: sample.endpointHash },
      indexProvidesOrder: false
    },
    {
      name: "push-by-user-revoked",
      collection: "push_subscriptions",
      indexName: "push_subscriptions_user_revoked",
      filter: { userId: sample.userId, revokedAt: null },
      indexProvidesOrder: false
    },
    {
      name: "delivery-by-idempotency-key",
      collection: "notification_deliveries",
      indexName: "notification_deliveries_idempotency_key",
      filter: { idempotencyKey: sample.idempotencyKey },
      indexProvidesOrder: false
    },
    {
      name: "deliveries-by-user",
      collection: "notification_deliveries",
      indexName: "notification_deliveries_user_created",
      filter: { userId: sample.userId },
      sort: { createdAt: -1 },
      limit: 20,
      indexProvidesOrder: true
    }
  ];
}

export function assertQueryCatalog(): void {
  const queries = buildMainQueries(createQuerySample());
  const names = new Set<string>();
  const usedIndexes = new Set<string>();

  for (const query of queries) {
    if (names.has(query.name) || query.name.length === 0) {
      throw new Error(`Некорректное имя запроса: ${query.name}`);
    }

    names.add(query.name);

    if (query.collection === "users") {
      throw new Error("Основные запросы не читают users по внешнему идентификатору");
    }

    const index = INDEX_DEFINITIONS.find((item) => item.name === query.indexName);

    if (!index || index.collection !== query.collection || index.kind === "ttl") {
      throw new Error(`Запрос ${query.name} указывает на неверный индекс ${query.indexName}`);
    }

    if (usedIndexes.has(query.indexName)) {
      throw new Error(`Индекс ${query.indexName} назначен двум запросам`);
    }

    usedIndexes.add(query.indexName);
    assertPartialFilter(query, index);
    assertSortMatchesIndex(query, index);

    if (query.limit !== undefined && (!Number.isInteger(query.limit) || query.limit < 1)) {
      throw new Error(`Запрос ${query.name} имеет некорректный limit`);
    }
  }

  for (const index of INDEX_DEFINITIONS) {
    if (index.kind !== "ttl" && !usedIndexes.has(index.name)) {
      throw new Error(`Для индекса ${index.name} нет основного запроса`);
    }
  }
}

function assertPartialFilter(query: MainQuery, index: IndexDefinition): void {
  if (index.kind === "ttl" || !index.partialFilterExpression) {
    return;
  }

  for (const [key, value] of Object.entries(index.partialFilterExpression)) {
    if (query.filter[key] !== value) {
      throw new Error(`Запрос ${query.name} не включает фильтр индекса ${key}`);
    }
  }
}

function assertSortMatchesIndex(query: MainQuery, index: IndexDefinition): void {
  const hasSort = query.sort !== undefined;

  if (query.indexProvidesOrder !== hasSort) {
    throw new Error(`Запрос ${query.name} неверно описывает порядок индекса`);
  }

  if (!query.sort || index.kind === "ttl") {
    return;
  }

  for (const [field, direction] of Object.entries(query.sort)) {
    const found = Object.entries(index.key).find(([key]) => key === field);

    if (!found || found[1] !== direction) {
      throw new Error(`Сортировка ${query.name} не совпадает с индексом ${index.name}`);
    }
  }
}
