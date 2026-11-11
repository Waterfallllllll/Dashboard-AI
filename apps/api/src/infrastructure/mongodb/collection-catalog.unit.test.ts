import { describe, expect, it } from "vitest";

import {
  COLLECTION_DEFINITIONS,
  COLLECTION_NAMES,
  getCollectionDefinition,
  type CollectionName,
  type DashboardConfigDocument,
  type IntegrationDocument,
  type NewsItemDocument,
  type NotificationDeliveryDocument,
  type PushSubscriptionDocument,
  type RoutineOccurrenceDocument,
  type RoutineRuleDocument,
  type OneTimeTokenDocument,
  type SessionDocument,
  type TimerSessionDocument,
  type UserDocument,
  type AuthAccountDocument
} from "./collection-catalog.js";

const SECRET_FIELD_NAMES = [
  "accessToken",
  "refreshToken",
  "password",
  "token",
  "botToken",
  "privateKey",
  "html",
  "body"
];

describe("каталог коллекций", () => {
  it("покрывает пользователей, сессии, виджеты, рутины, таймеры, интеграции, новости и уведомления", () => {
    expect(COLLECTION_NAMES).toEqual([
      "users",
      "auth_accounts",
      "sessions",
      "one_time_tokens",
      "dashboard_configs",
      "routine_rules",
      "routine_occurrences",
      "timer_sessions",
      "integrations",
      "news_items",
      "push_subscriptions",
      "notification_deliveries"
    ]);
    expect(COLLECTION_DEFINITIONS).toHaveLength(COLLECTION_NAMES.length);
  });

  it("не оставляет в схеме полей для открытых секретов и HTML", () => {
    for (const definition of COLLECTION_DEFINITIONS) {
      expect(definition.schema.additionalProperties).toBe(false);
      const fields = Object.keys(definition.schema.properties ?? {});

      for (const secretField of SECRET_FIELD_NAMES) {
        expect(fields, definition.name).not.toContain(secretField);
      }
    }

    expect(Object.keys(getCollectionDefinition("users").schema.properties ?? {})).not.toContain(
      "providerUserId"
    );
    expect(getCollectionDefinition("sessions").schema.properties?.tokenHash).toBeDefined();
    expect(
      getCollectionDefinition("integrations").schema.properties?.encryptedCredentials
    ).toBeDefined();
    expect(
      getCollectionDefinition("push_subscriptions").schema.properties?.encryptedKeys
    ).toBeDefined();
    expect(getCollectionDefinition("dashboard_configs").schema.properties?.widgets?.maxItems).toBe(
      12
    );
    expect(getCollectionDefinition("news_items").schema.properties?.excerpt?.maxLength).toBe(500);
  });

  it("совпадает с типами документов", () => {
    expectFields<UserDocument>()("users", [
      "_id",
      "schemaVersion",
      "displayName",
      "avatarUrl",
      "locale",
      "timezone",
      "timeFormat",
      "theme",
      "createdAt",
      "updatedAt",
      "deletedAt"
    ]);
    expectFields<AuthAccountDocument>()("auth_accounts", [
      "_id",
      "schemaVersion",
      "userId",
      "provider",
      "providerUserId",
      "encryptedAccessToken",
      "encryptedRefreshToken",
      "scope",
      "expiresAt",
      "createdAt",
      "updatedAt"
    ]);
    expectFields<SessionDocument>()("sessions", [
      "_id",
      "schemaVersion",
      "userId",
      "tokenHash",
      "expiresAt",
      "createdAt",
      "revokedAt"
    ]);
    expectFields<OneTimeTokenDocument>()("one_time_tokens", [
      "_id",
      "schemaVersion",
      "tokenHash",
      "purpose",
      "encryptedPayload",
      "expiresAt",
      "createdAt",
      "consumedAt"
    ]);
    expectFields<DashboardConfigDocument>()("dashboard_configs", [
      "_id",
      "schemaVersion",
      "userId",
      "widgets",
      "updatedAt"
    ]);
    expectFields<RoutineRuleDocument>()("routine_rules", [
      "_id",
      "schemaVersion",
      "userId",
      "title",
      "description",
      "startDate",
      "endDate",
      "recurrenceRule",
      "reminderLocalTime",
      "timezone",
      "status",
      "createdAt",
      "updatedAt",
      "deletedAt"
    ]);
    expectFields<RoutineOccurrenceDocument>()("routine_occurrences", [
      "_id",
      "schemaVersion",
      "userId",
      "routineRuleId",
      "localDate",
      "titleOverride",
      "status",
      "completedAt",
      "excludedAt"
    ]);
    expectFields<TimerSessionDocument>()("timer_sessions", [
      "_id",
      "schemaVersion",
      "userId",
      "preset",
      "runStatus",
      "phase",
      "startedAt",
      "pausedAt",
      "endsAt",
      "completedAt",
      "cycleNumber",
      "version"
    ]);
    expectFields<IntegrationDocument>()("integrations", [
      "_id",
      "schemaVersion",
      "userId",
      "type",
      "status",
      "encryptedCredentials",
      "scope",
      "externalUserId",
      "lastSyncAt",
      "syncCursor",
      "createdAt",
      "updatedAt",
      "deletedAt"
    ]);
    expectFields<NewsItemDocument>()("news_items", [
      "_id",
      "schemaVersion",
      "source",
      "title",
      "excerpt",
      "canonicalUrl",
      "contentHash",
      "publishedAt",
      "language",
      "topics",
      "imageUrl",
      "createdAt"
    ]);
    expectFields<PushSubscriptionDocument>()("push_subscriptions", [
      "_id",
      "schemaVersion",
      "userId",
      "endpointHash",
      "endpoint",
      "encryptedKeys",
      "createdAt",
      "revokedAt"
    ]);
    expectFields<NotificationDeliveryDocument>()("notification_deliveries", [
      "_id",
      "schemaVersion",
      "userId",
      "eventType",
      "channel",
      "idempotencyKey",
      "status",
      "attempts",
      "providerMessageId",
      "createdAt",
      "updatedAt",
      "deleteAt"
    ]);
  });
});

function expectFields<T extends Record<string, unknown>>() {
  return <const Fields extends readonly (keyof T)[]>(
    name: CollectionName,
    fields: Exclude<keyof T, Fields[number]> extends never ? Fields : never
  ): void => {
    expect(Object.keys(getCollectionDefinition(name).schema.properties ?? {}).sort()).toEqual(
      [...fields].map(String).sort()
    );
  };
}
