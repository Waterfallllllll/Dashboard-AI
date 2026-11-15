import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { INITIAL_MIGRATION, QUERY_INDEXES } from "./migration-catalog.js";
import {
  UNTIL_ACCOUNT_PURGE,
  WORKER_DELETE_POLICIES,
  assertNoTtlSyntax,
  assertRetentionPolicy,
  auditDeleteAt,
  auditRetentionViolation,
  deliveryRetentionViolation,
  notificationDeleteAt
} from "./retention.js";

const migrationSql = readFileSync(
  new URL(`../../../prisma/migrations/${INITIAL_MIGRATION}/migration.sql`, import.meta.url),
  "utf8"
);
const schema = readFileSync(new URL("../../../prisma/schema.prisma", import.meta.url), "utf8");

describe("сроки хранения PostgreSQL", () => {
  it("считает 30 дней доставки и 90 дней аудита", () => {
    const createdAt = new Date("2026-11-09T12:00:00.000Z");

    expect(notificationDeleteAt(createdAt).toISOString()).toBe("2026-12-09T12:00:00.000Z");
    expect(auditDeleteAt(createdAt).toISOString()).toBe("2027-02-07T12:00:00.000Z");
    expect(deliveryRetentionViolation(createdAt, notificationDeleteAt(createdAt))).toBeNull();
    expect(auditRetentionViolation(createdAt, auditDeleteAt(createdAt))).toBeNull();
    expect(deliveryRetentionViolation(createdAt, null)).toBe("DELIVERY_WITHOUT_EXPIRY");
    expect(auditRetentionViolation(createdAt, createdAt)).toBe("AUDIT_EXPIRY_OUT_OF_POLICY");
    expect(() => notificationDeleteAt(createdAt, 0)).toThrow(/Срок хранения уведомлений/);
    expect(() => auditDeleteAt(new Date(Number.NaN))).toThrow(/дата события аудита/);
  });

  it("отдаёт просроченные строки worker и не ставит срок на историю аккаунта", () => {
    expect(() => assertRetentionPolicy(QUERY_INDEXES)).not.toThrow();
    expect(() => assertRetentionPolicy([])).toThrow(/sessions_expires_at/);
    expect(UNTIL_ACCOUNT_PURGE).toEqual([
      "timer_presets",
      "timer_sessions",
      "routine_rules",
      "routine_occurrences",
      "calendar_events"
    ]);
    const kept = new Set<string>(UNTIL_ACCOUNT_PURGE);

    expect(WORKER_DELETE_POLICIES.filter((policy) => kept.has(policy.table))).toEqual([]);
    expect(() => assertNoTtlSyntax(migrationSql)).not.toThrow();
    expect(() => assertNoTtlSyntax(schema)).not.toThrow();
    expect(() => assertNoTtlSyntax("CREATE INDEX ttl ON sessions")).toThrow(/TTL/);
  });
});
