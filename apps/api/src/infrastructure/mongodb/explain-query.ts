import type { Db, Document } from "mongodb";

import { assertStoredCollections } from "./user-data.js";
import {
  buildMainQueries,
  createQuerySample,
  type MainQuery,
  type QuerySample
} from "./query-catalog.js";

export const INDEX_USED_REASON = "IXSCAN";
export const SMALL_COLLECTION_REASON = "индекс подходит, коллекция ещё маленькая";

// На меньшей коллекции MongoDB часто честно выбирает полный просмотр: он дешевле индекса.
export const PLANNER_SAMPLE_MIN_DOCUMENTS = 32;

const BLOCKING_SORT = new Set(["SORT", "SORT_KEY_GENERATOR"]);

export type ExplainAssessment = {
  readonly ok: boolean;
  readonly indexName: string | null;
  readonly stages: readonly string[];
  readonly reason: string;
};

export type QueryExplainResult = ExplainAssessment & {
  readonly name: string;
  readonly collection: MainQuery["collection"];
  readonly expectedIndex: string;
};

export function assessExplainDocument(
  explanation: Document,
  expectedIndex: string,
  indexProvidesOrder: boolean
): ExplainAssessment {
  const stages = collectStages(winningPlanOf(explanation));
  const stageNames = stages.map((item) => item.stage);
  const stats = explanation["executionStats"];

  if (!isRecord(stats) || stats.executionSuccess !== true) {
    return fail(stageNames, "MongoDB не подтвердил выполнение плана");
  }

  if (stageNames.includes("COLLSCAN")) {
    return fail(stageNames, "план читает коллекцию целиком");
  }

  if (indexProvidesOrder && stageNames.some((stage) => BLOCKING_SORT.has(stage))) {
    return fail(stageNames, "сортировка выполняется отдельно от индекса");
  }

  const indexNames = stages.flatMap((stage) =>
    stage.stage === "IXSCAN" && stage.indexName ? [stage.indexName] : []
  );

  if (indexNames.length === 0 || indexNames.some((name) => name !== expectedIndex)) {
    const actual = indexNames.length > 0 ? indexNames.join(", ") : "без индекса";
    return fail(stageNames, `план использует ${actual}, ожидался ${expectedIndex}`);
  }

  return {
    ok: true,
    indexName: expectedIndex,
    stages: stageNames,
    reason: INDEX_USED_REASON
  };
}

export function decideExplainResult(
  unhinted: ExplainAssessment,
  hinted: ExplainAssessment | null,
  documentCount: number
): ExplainAssessment {
  if (unhinted.ok) {
    return unhinted;
  }

  if (!hinted?.ok) {
    return hinted ?? unhinted;
  }

  if (documentCount >= PLANNER_SAMPLE_MIN_DOCUMENTS) {
    return {
      ok: false,
      indexName: unhinted.indexName,
      stages: unhinted.stages,
      reason: `при ${documentCount} документах планировщик не выбрал индекс: ${unhinted.reason}`
    };
  }

  return {
    ok: true,
    indexName: hinted.indexName,
    stages: hinted.stages,
    reason: SMALL_COLLECTION_REASON
  };
}

export async function explainMainQueries(
  db: Db,
  sample: QuerySample = createQuerySample()
): Promise<readonly QueryExplainResult[]> {
  await assertStoredCollections(db);
  const results: QueryExplainResult[] = [];

  for (const query of buildMainQueries(sample)) {
    results.push(await explainOne(db, query));
  }

  return results;
}

export async function explainNamedQuery(
  db: Db,
  name: string,
  sample: QuerySample = createQuerySample()
): Promise<QueryExplainResult> {
  await assertStoredCollections(db);
  const query = buildMainQueries(sample).find((item) => item.name === name);

  if (!query) {
    throw new Error(`Неизвестный запрос: ${name}`);
  }

  return explainOne(db, query);
}

async function explainOne(db: Db, query: MainQuery): Promise<QueryExplainResult> {
  const base = {
    name: query.name,
    collection: query.collection,
    expectedIndex: query.indexName
  };

  let unhinted: ExplainAssessment;

  try {
    unhinted = assessExplainDocument(
      await runExplain(db, query),
      query.indexName,
      query.indexProvidesOrder
    );
  } catch (error) {
    return { ...base, ...failedFromError(error) };
  }

  if (unhinted.ok) {
    return { ...base, ...unhinted };
  }

  const documentCount = await db.collection(query.collection).estimatedDocumentCount();
  let hinted: ExplainAssessment;

  try {
    hinted = assessExplainDocument(
      await runExplain(db, query, query.indexName),
      query.indexName,
      query.indexProvidesOrder
    );
  } catch (error) {
    hinted = failedFromError(error);
  }

  return { ...base, ...decideExplainResult(unhinted, hinted, documentCount) };
}

async function runExplain(db: Db, query: MainQuery, hint?: string): Promise<Document> {
  // Клиент уже задаёт timeoutMS. Вместе с maxTimeMS драйвер отклоняет explain.
  let cursor = db.collection(query.collection).find(query.filter);

  if (query.sort) {
    cursor = cursor.sort({ ...query.sort });
  }

  if (query.limit !== undefined) {
    cursor = cursor.limit(query.limit);
  }

  if (hint) {
    cursor = cursor.hint(hint);
  }

  return cursor.explain("executionStats");
}

function winningPlanOf(explanation: Document): unknown {
  const planner = explanation["queryPlanner"];
  return isRecord(planner) ? planner.winningPlan : undefined;
}

type SeenStage = { stage: string; indexName?: string };

function collectStages(node: unknown, seen: SeenStage[] = []): SeenStage[] {
  if (Array.isArray(node)) {
    for (const item of node) {
      collectStages(item, seen);
    }

    return seen;
  }

  if (!isRecord(node)) {
    return seen;
  }

  if (typeof node.stage === "string") {
    const stage: SeenStage = { stage: node.stage };

    if (typeof node.indexName === "string") {
      seen.push({ ...stage, indexName: node.indexName });
    } else {
      seen.push(stage);
    }
  }

  for (const value of Object.values(node)) {
    if (typeof value === "object" && value !== null) {
      collectStages(value, seen);
    }
  }

  return seen;
}

function fail(stages: readonly string[], reason: string): ExplainAssessment {
  const path = stages.length > 0 ? stages.join(" > ") : "пустой";

  return {
    ok: false,
    indexName: null,
    stages,
    reason: `${reason} (${path})`
  };
}

function failedFromError(error: unknown): ExplainAssessment {
  const message = error instanceof Error ? error.message : "запрос не разобран";

  return {
    ok: false,
    indexName: null,
    stages: [],
    reason: message.slice(0, 200)
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
