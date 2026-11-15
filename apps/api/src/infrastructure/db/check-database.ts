import type { PrismaClient } from "../../generated/prisma/client.js";

import type { IntegrityReport } from "./integrity.js";
import type { QueryExplainResult } from "./explain-query.js";
import { checkDataIntegrity } from "./integrity.js";
import { explainMainQueries } from "./explain-query.js";
import { assertQueryCatalog } from "./query-catalog.js";

export type DatabaseCheckReport = {
  readonly ok: boolean;
  readonly queries: readonly QueryExplainResult[];
  readonly integrity: IntegrityReport;
};

export async function checkDatabase(prisma: PrismaClient): Promise<DatabaseCheckReport> {
  assertQueryCatalog();
  const queries = await explainMainQueries(prisma);
  const integrity = await checkDataIntegrity(prisma);

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
