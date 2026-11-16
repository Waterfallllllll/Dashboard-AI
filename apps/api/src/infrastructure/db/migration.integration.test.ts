import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  ALL_PARTIAL_INDEXES,
  CIPHERTEXT_CHECKS,
  FOREIGN_KEY_INDEXES,
  FOREIGN_KEYS,
  QUERY_INDEXES,
  SOFT_DELETE_TABLES,
  UNIQUE_INDEXES,
  unexpectedMigrationDrift
} from "./migration-catalog.js";
import { connectDatabase, disconnectPrisma, getPrismaClient } from "./prisma-client.js";

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
const apiRoot = fileURLToPath(new URL("../../../", import.meta.url));
const databaseUrl = process.env.DATABASE_URL ?? "";
const hasPostgres =
  databaseUrl.startsWith("postgresql://") || databaseUrl.startsWith("postgres://");
const ciphertext = "enc:v1:AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBB.QQqq";

type IndexRow = {
  index_name: string;
  is_unique: boolean;
  predicate: string | null;
};

type ConstraintRow = {
  name: string;
  definition: string;
};

type CountRow = {
  count: number;
};

describe.skipIf(!hasPostgres)("применённая миграция PostgreSQL", () => {
  beforeAll(async () => {
    await runPrisma(["migrate", "deploy"]);
    await connectDatabase();
    const prisma = getPrismaClient();
    await prisma.$executeRaw`
      DELETE FROM "users" WHERE "display_name" = 'Проверка миграции'
    `;
    await prisma.$executeRaw`
      DELETE FROM "one_time_tokens" WHERE "token_hash" LIKE 'migration-test-%'
    `;
  }, 120_000);

  afterAll(async () => {
    await disconnectPrisma();
  });

  it("сохраняет внешние ключи, индексы, мягкое удаление и проверки ciphertext", async () => {
    const prisma = getPrismaClient();
    const indexes = await prisma.$queryRaw<IndexRow[]>`
      SELECT
        i.relname AS index_name,
        ix.indisunique AS is_unique,
        pg_get_expr(ix.indpred, ix.indrelid) AS predicate
      FROM pg_index ix
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_class t ON t.oid = ix.indrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
    `;
    const byName = new Map(indexes.map((row) => [row.index_name, row]));

    for (const index of ALL_PARTIAL_INDEXES) {
      const row = byName.get(index.name);
      expect(row?.is_unique).toBe(index.unique);
      expect(row?.predicate ?? "").toContain(predicateFragment(index.where));
    }

    for (const name of UNIQUE_INDEXES) {
      expect(byName.get(name)?.is_unique).toBe(true);
      expect(byName.get(name)?.predicate ?? null).toBeNull();
    }

    for (const name of [...QUERY_INDEXES, ...FOREIGN_KEY_INDEXES]) {
      expect(byName.has(name)).toBe(true);
    }

    const defaults = await prisma.$queryRaw<Array<{ column_default: string | null }>>`
      SELECT column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'id'
    `;
    expect(defaults[0]?.column_default ?? "").toContain("uuidv7()");

    const foreignKeys = await prisma.$queryRaw<ConstraintRow[]>`
      SELECT con.conname AS name, pg_get_constraintdef(con.oid) AS definition
      FROM pg_constraint con
      JOIN pg_namespace n ON n.oid = con.connamespace
      WHERE n.nspname = 'public' AND con.contype = 'f'
    `;
    const foreignKeyByName = new Map(foreignKeys.map((row) => [row.name, row.definition]));

    for (const name of FOREIGN_KEYS) {
      expect(foreignKeyByName.get(name) ?? "").toContain("ON DELETE CASCADE");
    }

    const checks = await prisma.$queryRaw<Array<{ name: string }>>`
      SELECT con.conname AS name
      FROM pg_constraint con
      JOIN pg_namespace n ON n.oid = con.connamespace
      WHERE n.nspname = 'public' AND con.contype = 'c'
    `;
    const checkNames = new Set(checks.map((row) => row.name));

    for (const check of CIPHERTEXT_CHECKS) {
      expect(checkNames.has(check.name)).toBe(true);
    }

    const softDelete = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND column_name = 'deleted_at'
        AND is_nullable = 'YES'
        AND data_type = 'timestamp with time zone'
    `;

    expect(softDelete.map((row) => row.table_name).sort()).toEqual([...SOFT_DELETE_TABLES].sort());
  });

  it("запрещает вторую живую интеграцию и вторую открытую сессию таймера", async () => {
    const userId = randomUUID();
    const firstIntegration = randomUUID();
    const firstSession = randomUUID();

    try {
      await insertUser(userId);
      await insertIntegration(firstIntegration, userId);
      await expectRejection(
        () => insertIntegration(randomUUID(), userId),
        "integrations_user_type"
      );
      await getPrismaClient().$executeRaw`
        UPDATE "integrations"
        SET "deleted_at" = NOW()
        WHERE "id" = ${firstIntegration}::uuid
      `;
      await insertIntegration(randomUUID(), userId);
      expect(await countRows("integrations", userId)).toBe(2);

      await insertTimerSession(firstSession, userId);
      await expectRejection(
        () => insertTimerSession(randomUUID(), userId),
        "timer_sessions_one_active_user"
      );
      await getPrismaClient().$executeRaw`
        UPDATE "timer_sessions"
        SET "completed_at" = NOW()
        WHERE "id" = ${firstSession}::uuid
      `;
      await insertTimerSession(randomUUID(), userId);
      expect(await countRows("timer_sessions", userId)).toBe(2);
    } finally {
      await deleteUser(userId);
    }
  });

  it("не даёт экземпляру рутины ссылаться на чужое правило и удаляет зависимые строки каскадом", async () => {
    const ownerId = randomUUID();
    const otherId = randomUUID();
    const ruleId = randomUUID();

    try {
      await insertUser(ownerId);
      await insertUser(otherId);
      await insertRoutine(ruleId, ownerId);
      await expectRejection(
        () => insertOccurrence(randomUUID(), ruleId, otherId),
        "routine_occurrences_routine_rule_id_user_id_fkey"
      );
      await insertOccurrence(randomUUID(), ruleId, ownerId);
      await insertAuthAccount(randomUUID(), ownerId, ciphertext);
      await deleteUser(ownerId);
      expect(await countRows("routine_rules", ownerId)).toBe(0);
      expect(await countRows("routine_occurrences", ownerId)).toBe(0);
      expect(await countRows("auth_accounts", ownerId)).toBe(0);
      expect(await countRows("users", ownerId)).toBe(0);
    } finally {
      await deleteUser(ownerId);
      await deleteUser(otherId);
    }
  });

  it("отклоняет открытый секрет и принимает ciphertext", async () => {
    const userId = randomUUID();
    const tokenId = randomUUID();

    try {
      await insertUser(userId);
      await expectRejection(
        () => insertAuthAccount(randomUUID(), userId, "plain-secret"),
        "auth_accounts_access_token_ciphertext"
      );
      await insertAuthAccount(randomUUID(), userId, ciphertext);
      await expectRejection(
        () => insertToken(tokenId, "plain-secret"),
        "one_time_tokens_payload_ciphertext"
      );
      await insertToken(tokenId, ciphertext);
    } finally {
      await deleteUser(userId);
      await getPrismaClient().$executeRaw`
        DELETE FROM "one_time_tokens" WHERE "id" = ${tokenId}::uuid
      `;
    }
  });

  it("отличается от схемы Prisma только частичными индексами и проверками ciphertext", async () => {
    const { stdout } = await runPrisma([
      "migrate",
      "diff",
      "--from-migrations",
      "prisma/migrations",
      "--to-schema",
      "prisma/schema.prisma",
      "--script"
    ]);
    const start = stdout.search(/^(--|ALTER|DROP|CREATE)/m);
    const script = start < 0 ? stdout : stdout.slice(start);

    expect(script).toContain("DROP INDEX");
    expect(script).toContain("DROP CONSTRAINT");
    expect(unexpectedMigrationDrift(script)).toEqual([]);
  });
});

function runPrisma(args: readonly string[]): Promise<{ stdout: string }> {
  return execFileAsync(process.execPath, [require.resolve("prisma/build/index.js"), ...args], {
    cwd: apiRoot,
    env: process.env,
    encoding: "utf8",
    timeout: 120_000,
    maxBuffer: 10 * 1024 * 1024
  });
}

function predicateFragment(where: string): string {
  if (where.includes("deleted_at")) {
    return "deleted_at IS NULL";
  }

  if (where.includes("completed_at")) {
    return "completed_at IS NULL";
  }

  return "status = 'pending'";
}

async function insertUser(id: string): Promise<void> {
  await getPrismaClient().$executeRaw`
    INSERT INTO "users" ("id", "display_name", "locale", "timezone", "updated_at")
    VALUES (${id}::uuid, 'Проверка миграции', 'ru', 'Europe/Moscow', NOW())
  `;
}

async function deleteUser(id: string): Promise<void> {
  await getPrismaClient().$executeRaw`
    DELETE FROM "users" WHERE "id" = ${id}::uuid
  `;
}

async function insertIntegration(id: string, userId: string): Promise<void> {
  await getPrismaClient().$executeRaw`
    INSERT INTO "integrations" ("id", "user_id", "type", "status", "updated_at")
    VALUES (
      ${id}::uuid,
      ${userId}::uuid,
      'telegram'::"integration_type",
      'connected'::"integration_status",
      NOW()
    )
  `;
}

async function insertTimerSession(id: string, userId: string): Promise<void> {
  await getPrismaClient().$executeRaw`
    INSERT INTO "timer_sessions" (
      "id",
      "user_id",
      "mode",
      "work_minutes",
      "short_break_minutes",
      "long_break_minutes",
      "run_status",
      "phase"
    )
    VALUES (
      ${id}::uuid,
      ${userId}::uuid,
      'pomodoro'::"timer_mode",
      25,
      5,
      15,
      'running'::"timer_run_status",
      'work'::"timer_phase"
    )
  `;
}

async function insertRoutine(id: string, userId: string): Promise<void> {
  await getPrismaClient().$executeRaw`
    INSERT INTO "routine_rules" (
      "id",
      "user_id",
      "title",
      "start_date",
      "recurrence_kind",
      "recurrence_days",
      "timezone",
      "status",
      "updated_at"
    )
    VALUES (
      ${id}::uuid,
      ${userId}::uuid,
      'Вода',
      CURRENT_DATE,
      'daily'::"recurrence_kind",
      ARRAY[]::integer[],
      'Europe/Moscow',
      'active'::"routine_status",
      NOW()
    )
  `;
}

async function insertOccurrence(id: string, ruleId: string, userId: string): Promise<void> {
  await getPrismaClient().$executeRaw`
    INSERT INTO "routine_occurrences" ("id", "routine_rule_id", "user_id", "local_date", "status")
    VALUES (
      ${id}::uuid,
      ${ruleId}::uuid,
      ${userId}::uuid,
      CURRENT_DATE,
      'pending'::"occurrence_status"
    )
  `;
}

async function insertAuthAccount(id: string, userId: string, accessToken: string): Promise<void> {
  await getPrismaClient().$executeRaw`
    INSERT INTO "auth_accounts" (
      "id",
      "user_id",
      "provider",
      "provider_user_id",
      "access_token",
      "scope",
      "updated_at"
    )
    VALUES (
      ${id}::uuid,
      ${userId}::uuid,
      'google'::"auth_provider",
      ${`migration-${id}`},
      ${accessToken},
      ARRAY[]::text[],
      NOW()
    )
  `;
}

async function insertToken(id: string, payload: string): Promise<void> {
  await getPrismaClient().$executeRaw`
    INSERT INTO "one_time_tokens" ("id", "token_hash", "purpose", "payload", "expires_at")
    VALUES (
      ${id}::uuid,
      ${`migration-test-${id}`},
      'oauth_state'::"one_time_token_purpose",
      ${payload},
      NOW() + INTERVAL '10 minutes'
    )
  `;
}

type CountTable =
  | "users"
  | "integrations"
  | "timer_sessions"
  | "routine_rules"
  | "routine_occurrences"
  | "auth_accounts";

async function countRows(table: CountTable, userId: string): Promise<number> {
  const rows = await countQuery(table, userId);
  return Number(rows[0]?.count ?? 0);
}

function countQuery(table: CountTable, userId: string): Promise<CountRow[]> {
  const prisma = getPrismaClient();

  switch (table) {
    case "users":
      return prisma.$queryRaw<CountRow[]>`
        SELECT COUNT(*)::int AS count FROM "users" WHERE "id" = ${userId}::uuid
      `;
    case "integrations":
      return prisma.$queryRaw<CountRow[]>`
        SELECT COUNT(*)::int AS count FROM "integrations" WHERE "user_id" = ${userId}::uuid
      `;
    case "timer_sessions":
      return prisma.$queryRaw<CountRow[]>`
        SELECT COUNT(*)::int AS count FROM "timer_sessions" WHERE "user_id" = ${userId}::uuid
      `;
    case "routine_rules":
      return prisma.$queryRaw<CountRow[]>`
        SELECT COUNT(*)::int AS count FROM "routine_rules" WHERE "user_id" = ${userId}::uuid
      `;
    case "routine_occurrences":
      return prisma.$queryRaw<CountRow[]>`
        SELECT COUNT(*)::int AS count FROM "routine_occurrences" WHERE "user_id" = ${userId}::uuid
      `;
    case "auth_accounts":
      return prisma.$queryRaw<CountRow[]>`
        SELECT COUNT(*)::int AS count FROM "auth_accounts" WHERE "user_id" = ${userId}::uuid
      `;
  }
}

async function expectRejection(run: () => Promise<unknown>, marker: string): Promise<void> {
  try {
    await run();
  } catch (error) {
    expect(errorText(error)).toContain(marker);
    return;
  }

  throw new Error(`Ожидался отказ базы: ${marker}`);
}

function errorText(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const details = error as Error & { code?: string; meta?: unknown; cause?: unknown };
  return [details.message, details.code, JSON.stringify(details.meta), errorText(details.cause)]
    .filter((part) => part !== undefined)
    .join(" ");
}
