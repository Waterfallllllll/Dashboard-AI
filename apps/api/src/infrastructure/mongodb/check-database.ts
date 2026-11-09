import type { Db } from "mongodb";

import { explainMainQueries, type QueryExplainResult } from "./explain-query.js";
import { checkDataIntegrity, type IntegrityReport } from "./integrity.js";
import { assertQueryCatalog } from "./query-catalog.js";
import { assertHistoryRetention } from "./retention.js";
import { assertUserDataCoverage } from "./user-data.js";

export type DatabaseCheckReport = {
  readonly ok: boolean;
  readonly queries: readonly QueryExplainResult[];
  readonly integrity: IntegrityReport;
};

export async function checkDatabase(db: Db): Promise<DatabaseCheckReport> {
  assertUserDataCoverage();
  assertQueryCatalog();
  assertHistoryRetention();
  const queries = await explainMainQueries(db);
  const integrity = await checkDataIntegrity(db);

  return {
    ok: queries.every((query) => query.ok) && integrity.ok,
    queries,
    integrity
  };
}

export function formatDatabaseCheck(report: DatabaseCheckReport): string {
  const failedQueries = report.queries.filter((query) => !query.ok);
  const lines = [
    `Запросы: ${report.queries.length}. Без нужного индекса: ${failedQueries.length}.`
  ];

  for (const query of failedQueries) {
    lines.push(`- ${query.name}: ${query.reason}`);
  }

  lines.push(`Целостность: нарушений ${report.integrity.violations.length}.`);

  for (const violation of report.integrity.violations) {
    lines.push(`- ${violation.collection} ${violation.code} ${violation.documentId}`);
  }

  if (report.integrity.truncated) {
    lines.push("Список нарушений обрезан.");
  }

  return `${lines.join("\n")}\n`;
}
