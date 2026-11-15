export const INDEX_USED_REASON = "индекс использован";
export const SMALL_TABLE_REASON = "на малой таблице целевой индекс подтверждён отдельным планом";
export const SMALL_TABLE_MAX_ROWS = 1000;

const INDEX_SCANS = new Set(["Index Scan", "Index Only Scan", "Bitmap Index Scan"]);
const SORTS = new Set(["Sort", "Incremental Sort"]);
const SEQUENTIAL = new Set(["Seq Scan", "Parallel Seq Scan"]);

export type ExplainAssessment = {
  readonly ok: boolean;
  readonly sorted: boolean;
  readonly seqScan: boolean;
  readonly indexNames: readonly string[];
  readonly stages: readonly string[];
  readonly reason: string;
};

export type PlanAttempt = {
  readonly natural: ExplainAssessment;
  readonly forced: ExplainAssessment | null;
  readonly ordered: ExplainAssessment | null;
  readonly proved: ExplainAssessment | null;
  readonly rowCount: number;
  readonly indexExists: boolean;
};

export function readExplainPlan(rows: unknown): unknown {
  const row = Array.isArray(rows) ? rows[0] : rows;

  if (!isRecord(row)) {
    return undefined;
  }

  const raw = row["QUERY PLAN"] ?? row["query plan"];
  const parsed = typeof raw === "string" ? parseJson(raw) : raw;
  const entry = Array.isArray(parsed) ? parsed[0] : parsed;

  if (!isRecord(entry)) {
    return undefined;
  }

  return "Plan" in entry ? entry.Plan : entry;
}

export function assessPostgresPlan(
  plan: unknown,
  expectedIndex: string,
  indexProvidesOrder: boolean
): ExplainAssessment {
  const stages: string[] = [];
  const indexNames: string[] = [];
  let sorted = false;
  let seqScan = false;
  walk(plan, stages, indexNames, (kind) => {
    if (kind === "sort") {
      sorted = true;
    }

    if (kind === "seq") {
      seqScan = true;
    }
  });

  if (stages.length === 0) {
    return fail(stages, indexNames, sorted, seqScan, "пустой план");
  }

  if (seqScan || indexNames.length === 0 || indexNames.some((name) => name !== expectedIndex)) {
    const actual =
      indexNames.length > 0 ? indexNames.join(", ") : seqScan ? "Seq Scan" : "без индекса";
    return fail(
      stages,
      indexNames,
      sorted,
      seqScan,
      `план использует ${actual}, ожидался ${expectedIndex}`
    );
  }

  if (indexProvidesOrder && sorted) {
    return fail(stages, indexNames, sorted, seqScan, "сортировка выполняется отдельно от индекса");
  }

  return {
    ok: true,
    sorted,
    seqScan,
    indexNames,
    stages,
    reason: INDEX_USED_REASON
  };
}

export function decideQueryPlan(attempt: PlanAttempt): ExplainAssessment {
  if (attempt.natural.ok) {
    return attempt.natural;
  }

  if (!attempt.indexExists) {
    return { ...attempt.natural, ok: false, reason: "индекс отсутствует в pg_indexes" };
  }

  if (attempt.rowCount >= SMALL_TABLE_MAX_ROWS) {
    return attempt.natural;
  }

  const winner = [attempt.proved, attempt.ordered, attempt.forced].find((item) => item?.ok);

  if (winner) {
    return { ...winner, reason: SMALL_TABLE_REASON };
  }

  return attempt.proved ?? attempt.ordered ?? attempt.forced ?? attempt.natural;
}

function walk(
  node: unknown,
  stages: string[],
  indexNames: string[],
  mark: (kind: "sort" | "seq") => void
): void {
  if (!isRecord(node)) {
    return;
  }

  const nodeType = node["Node Type"];

  if (typeof nodeType === "string") {
    stages.push(nodeType);

    if (SORTS.has(nodeType)) {
      mark("sort");
    }

    if (SEQUENTIAL.has(nodeType)) {
      mark("seq");
    }

    if (INDEX_SCANS.has(nodeType)) {
      const indexName = node["Index Name"];
      indexNames.push(typeof indexName === "string" ? indexName : "без имени");
    }
  }

  const children = node.Plans;

  if (Array.isArray(children)) {
    for (const child of children) {
      walk(child, stages, indexNames, mark);
    }
  }
}

function fail(
  stages: readonly string[],
  indexNames: readonly string[],
  sorted: boolean,
  seqScan: boolean,
  reason: string
): ExplainAssessment {
  const path = stages.length > 0 ? stages.join(" > ") : "пустой";

  return {
    ok: false,
    sorted,
    seqScan,
    indexNames,
    stages,
    reason: `${reason} (${path})`
  };
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
