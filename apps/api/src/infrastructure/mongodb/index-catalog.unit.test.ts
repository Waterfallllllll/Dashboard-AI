import { describe, expect, it } from "vitest";

import { COLLECTION_NAMES } from "./collection-catalog.js";
import {
  INDEX_DEFINITIONS,
  assertIndexCatalog,
  type IndexDefinition,
  type PartialFilter
} from "./index-catalog.js";

describe("каталог индексов", () => {
  it("покрывает unique, TTL и query-индексы существующих коллекций", () => {
    expect(() => assertIndexCatalog()).not.toThrow();
    expect(INDEX_DEFINITIONS.map((index) => index.name)).toEqual([
      "auth_accounts_provider_identity",
      "auth_accounts_user_provider",
      "sessions_token_hash",
      "sessions_expires_at",
      "dashboard_configs_user",
      "routine_rules_user_status",
      "routine_rules_user_start_date",
      "routine_occurrences_rule_date",
      "routine_occurrences_user_date",
      "timer_sessions_user_started_at",
      "timer_sessions_one_active_user",
      "integrations_user_type",
      "news_items_content_hash",
      "news_items_published_topics_language",
      "push_subscriptions_endpoint_hash",
      "push_subscriptions_user_revoked",
      "notification_deliveries_idempotency_key",
      "notification_deliveries_user_created",
      "notification_deliveries_delete_at"
    ]);
    expect(indexedCollections()).toEqual(
      COLLECTION_NAMES.filter((name) => name !== "users").sort()
    );
  });

  it("оставляет TTL только у сессий и журнала доставки, а мягкое удаление — в partial-индексах", () => {
    expect(indexByName("sessions_expires_at")).toMatchObject({
      kind: "ttl",
      key: { expiresAt: 1 },
      expireAfterSeconds: 0
    });
    expect(indexByName("notification_deliveries_delete_at")).toMatchObject({
      kind: "ttl",
      key: { deleteAt: 1 },
      expireAfterSeconds: 0
    });
    expect(INDEX_DEFINITIONS.filter((index) => index.kind === "ttl")).toHaveLength(2);
    expect(partialFilter("integrations_user_type")).toEqual({ deletedAt: null });
    expect(partialFilter("routine_rules_user_status")).toEqual({ deletedAt: null });
    expect(indexByName("timer_sessions_one_active_user")).toMatchObject({
      kind: "unique",
      key: { userId: 1 },
      partialFilterExpression: { completedAt: null }
    });
    expect(indexByName("news_items_published_topics_language").key).toEqual({
      publishedAt: -1,
      topics: 1,
      language: 1
    });
  });
});

function indexedCollections(): string[] {
  return [...new Set(INDEX_DEFINITIONS.map((index) => index.collection))].sort();
}

function partialFilter(name: string): PartialFilter | undefined {
  const index = indexByName(name);

  if (index.kind === "ttl") {
    throw new Error(`У индекса ${name} нет фильтра живых документов`);
  }

  return index.partialFilterExpression;
}

function indexByName(name: string): IndexDefinition {
  const index = INDEX_DEFINITIONS.find((item) => item.name === name);

  if (!index) {
    throw new Error(`Индекс не найден: ${name}`);
  }

  return index;
}
