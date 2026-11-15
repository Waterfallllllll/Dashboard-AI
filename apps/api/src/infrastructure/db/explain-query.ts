import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";

import {
  SMALL_TABLE_MAX_ROWS,
  assessPostgresPlan,
  decideQueryPlan,
  readExplainPlan,
  type ExplainAssessment
} from "./explain-plan.js";
import {
  buildMainQueries,
  createQuerySample,
  type MainQuery,
  type QuerySample
} from "./query-catalog.js";

const EXPLAIN_TIMEOUT_MS = 20_000;

class RolledBack<T> extends Error {
  readonly value: T;

  constructor(value: T) {
    super("Проверка плана откатывает пробные строки");
    this.name = "RolledBack";
    this.value = value;
  }
}

export type QueryExplainResult = ExplainAssessment & {
  readonly name: string;
  readonly table: MainQuery["table"];
  readonly expectedIndex: string;
};

export async function explainMainQueries(
  prisma: PrismaClient,
  sample: QuerySample = createQuerySample()
): Promise<readonly QueryExplainResult[]> {
  const [rowCounts, indexNames] = await Promise.all([
    readRowCounts(prisma),
    readIndexNames(prisma)
  ]);
  const results: QueryExplainResult[] = [];

  for (const query of buildMainQueries(sample)) {
    results.push(await explainOne(prisma, query, sample, rowCounts, indexNames));
  }

  return results;
}

export async function explainNamedQuery(
  prisma: PrismaClient,
  name: string,
  sample: QuerySample = createQuerySample()
): Promise<QueryExplainResult> {
  const query = buildMainQueries(sample).find((item) => item.name === name);

  if (!query) {
    throw new Error(`Неизвестный запрос: ${name}`);
  }

  const [rowCounts, indexNames] = await Promise.all([
    readRowCounts(prisma),
    readIndexNames(prisma)
  ]);

  return explainOne(prisma, query, sample, rowCounts, indexNames);
}

async function explainOne(
  prisma: PrismaClient,
  query: MainQuery,
  sample: QuerySample,
  rowCounts: ReadonlyMap<string, number>,
  indexNames: ReadonlySet<string>
): Promise<QueryExplainResult> {
  const assessment = await inRolledBackTransaction(prisma, async (tx) => {
    const natural = await readAssessment(tx, query, sample);
    const rowCount = rowCounts.get(query.table) ?? Number.POSITIVE_INFINITY;
    const indexExists = indexNames.has(query.indexName);

    if (natural.ok || !indexExists || rowCount >= SMALL_TABLE_MAX_ROWS) {
      return decideQueryPlan({
        natural,
        forced: null,
        ordered: null,
        proved: null,
        rowCount,
        indexExists
      });
    }

    await tx.$queryRaw`SELECT set_config('enable_seqscan', 'off', true)`;
    const forced = await readAssessment(tx, query, sample);
    const ordered =
      !forced.ok && query.indexProvidesOrder && forced.sorted
        ? await readOrderedAssessment(tx, query, sample)
        : null;
    const proved =
      !forced.ok && !ordered?.ok && query.prepare
        ? await readProvedAssessment(tx, query, sample)
        : null;

    return decideQueryPlan({
      natural,
      forced,
      ordered,
      proved,
      rowCount,
      indexExists
    });
  });

  return {
    ...assessment,
    name: query.name,
    table: query.table,
    expectedIndex: query.indexName
  };
}

async function readOrderedAssessment(
  tx: Prisma.TransactionClient,
  query: MainQuery,
  sample: QuerySample
): Promise<ExplainAssessment> {
  await tx.$queryRaw`SELECT set_config('enable_bitmapscan', 'off', true)`;
  return readAssessment(tx, query, sample);
}

async function readProvedAssessment(
  tx: Prisma.TransactionClient,
  query: MainQuery,
  sample: QuerySample
): Promise<ExplainAssessment> {
  await query.prepare?.(tx, sample);
  return readAssessment(tx, query, sample);
}

async function readAssessment(
  tx: Prisma.TransactionClient,
  query: MainQuery,
  sample: QuerySample
): Promise<ExplainAssessment> {
  const rows: unknown = await tx.$queryRaw(
    Prisma.sql`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query.statement(sample)}`
  );

  return assessPostgresPlan(readExplainPlan(rows), query.indexName, query.indexProvidesOrder);
}

async function inRolledBackTransaction<T>(
  prisma: PrismaClient,
  run: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  try {
    await prisma.$transaction(
      async (tx) => {
        throw new RolledBack(await run(tx));
      },
      { timeout: EXPLAIN_TIMEOUT_MS }
    );
  } catch (error) {
    const value = readRolledBack<T>(error);

    if (value !== undefined) {
      return value;
    }

    throw error;
  }

  throw new Error("Транзакция проверки плана завершилась без отката");
}

function readRolledBack<T>(error: unknown): T | undefined {
  const seen = new Set<unknown>();
  let current = error;

  while (typeof current === "object" && current !== null && !seen.has(current)) {
    seen.add(current);

    if (current instanceof RolledBack) {
      return current.value as T;
    }

    if (isRolledBackValue<T>(current)) {
      return current.value;
    }

    current = "cause" in current ? current.cause : undefined;
  }

  return undefined;
}

function isRolledBackValue<T>(error: object): error is { value: T } {
  return "name" in error && error.name === "RolledBack" && "value" in error;
}

async function readRowCounts(prisma: PrismaClient): Promise<Map<string, number>> {
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT
      (SELECT COUNT(*)::int FROM "auth_accounts") AS "auth_accounts",
      (SELECT COUNT(*)::int FROM "sessions") AS "sessions",
      (SELECT COUNT(*)::int FROM "one_time_tokens") AS "one_time_tokens",
      (SELECT COUNT(*)::int FROM "widget_preferences") AS "widget_preferences",
      (SELECT COUNT(*)::int FROM "routine_rules") AS "routine_rules",
      (SELECT COUNT(*)::int FROM "routine_occurrences") AS "routine_occurrences",
      (SELECT COUNT(*)::int FROM "timer_presets") AS "timer_presets",
      (SELECT COUNT(*)::int FROM "timer_sessions") AS "timer_sessions",
      (SELECT COUNT(*)::int FROM "integrations") AS "integrations",
      (SELECT COUNT(*)::int FROM "calendar_events") AS "calendar_events",
      (SELECT COUNT(*)::int FROM "news_items") AS "news_items",
      (SELECT COUNT(*)::int FROM "push_subscriptions") AS "push_subscriptions",
      (SELECT COUNT(*)::int FROM "scheduled_jobs") AS "scheduled_jobs",
      (SELECT COUNT(*)::int FROM "notification_deliveries") AS "notification_deliveries",
      (SELECT COUNT(*)::int FROM "audit_events") AS "audit_events"
  `;
  const row = rows[0] ?? {};
  const counts = new Map<string, number>();

  for (const [table, value] of Object.entries(row)) {
    counts.set(table, readCount(value));
  }

  return counts;
}

async function readIndexNames(prisma: PrismaClient): Promise<Set<string>> {
  const rows = await prisma.$queryRaw<Array<{ indexname: string }>>`
    SELECT indexname FROM pg_indexes WHERE schemaname = 'public'
  `;

  return new Set(rows.map((row) => row.indexname));
}

function readCount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (typeof value === "string" && /^\d+$/.test(value)) {
    return Number(value);
  }

  return Number.POSITIVE_INFINITY;
}
