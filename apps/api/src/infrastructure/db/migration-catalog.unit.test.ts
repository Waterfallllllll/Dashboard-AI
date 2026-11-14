import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  CIPHERTEXT_CHECKS,
  FOREIGN_KEYS,
  INITIAL_MIGRATION,
  PARTIAL_INDEXES,
  QUERY_INDEXES,
  SOFT_DELETE_TABLES,
  UNIQUE_INDEXES,
  renderMigrationExtras,
  unexpectedMigrationDrift
} from "./migration-catalog.js";

const migrationLock = readFileSync(
  new URL("../../../prisma/migrations/migration_lock.toml", import.meta.url),
  "utf8"
);
const migrationSql = readFileSync(
  new URL(`../../../prisma/migrations/${INITIAL_MIGRATION}/migration.sql`, import.meta.url),
  "utf8"
);
const extras = renderMigrationExtras();
const generatedSql = migrationSql.slice(0, migrationSql.length - extras.length);

describe("первая миграция Prisma", () => {
  it("добавляет частичные индексы и проверки ciphertext после схемы Prisma", () => {
    expect(migrationLock).toContain('provider = "postgresql"');
    expect(migrationSql.includes("\r")).toBe(false);
    expect(migrationSql.endsWith(extras)).toBe(true);
    expect(migrationSql.indexOf("-- PartialIndex")).toBe(generatedSql.length);
    expect(generatedSql).not.toContain("DROP ");
    expect(generatedSql.match(/gen_random_uuid\(\)/g)).toHaveLength(16);
  });

  it("создаёт внешние ключи, unique, query-индексы, мягкое удаление и поля секретов", () => {
    for (const name of FOREIGN_KEYS) {
      const constraint = generatedSql
        .split("\n")
        .find((line) => line.includes(`ADD CONSTRAINT "${name}"`));

      expect(constraint).toContain("FOREIGN KEY");
      expect(constraint).toContain("ON DELETE CASCADE");
    }

    for (const name of UNIQUE_INDEXES) {
      expect(generatedSql).toContain(`CREATE UNIQUE INDEX "${name}"`);
    }

    for (const name of QUERY_INDEXES) {
      expect(generatedSql).toContain(`CREATE INDEX "${name}"`);
    }

    expect(generatedSql).toContain('CREATE INDEX "news_items_topics" ON "news_items" USING GIN');

    for (const table of SOFT_DELETE_TABLES) {
      expect(generatedSql).toContain(`CREATE TABLE "${table}"`);
    }

    expect(generatedSql.match(/"deleted_at" TIMESTAMPTZ/g)).toHaveLength(SOFT_DELETE_TABLES.length);
    expect(generatedSql).toContain('"access_token" TEXT');
    expect(generatedSql).toContain('"refresh_token" TEXT');
    expect(generatedSql).toContain('"credentials" TEXT');
    expect(generatedSql).toContain('"keys" TEXT NOT NULL');
    expect(generatedSql).toContain('"payload" TEXT NOT NULL');
    expect(PARTIAL_INDEXES.map((index) => index.name)).toEqual([
      "routine_rules_user_status",
      "routine_rules_user_start_date",
      "timer_sessions_one_active_user",
      "integrations_user_type",
      "scheduled_jobs_pending_run_at"
    ]);
    expect(CIPHERTEXT_CHECKS).toHaveLength(5);
  });

  it("считает расхождением только удаление частичных индексов и проверок ciphertext", () => {
    const expected = [
      ...PARTIAL_INDEXES.map((index) => `DROP INDEX "${index.name}"`),
      ...CIPHERTEXT_CHECKS.map(
        (check) => `ALTER TABLE "${check.table}" DROP CONSTRAINT "${check.name}"`
      )
    ].join(";\n");

    expect(unexpectedMigrationDrift(expected)).toEqual([]);
    expect(unexpectedMigrationDrift('DROP TABLE "users"')).toEqual(['DROP TABLE "users"']);
    expect(unexpectedMigrationDrift("")).toEqual([]);
  });
});
