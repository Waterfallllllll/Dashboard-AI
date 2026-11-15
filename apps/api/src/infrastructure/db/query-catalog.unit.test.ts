import { describe, expect, it } from "vitest";

import { PARTIAL_INDEXES, QUERY_INDEXES, UNIQUE_INDEXES } from "./migration-catalog.js";
import {
  QUERY_TABLES,
  assertQueryCatalog,
  buildMainQueries,
  createQuerySample,
  secretColumnInSql,
  sqlText
} from "./query-catalog.js";

describe("каталог запросов PostgreSQL", () => {
  it("назначает каждому индексу один запрос без секретов и без TTL", () => {
    const sample = createQuerySample();
    const queries = buildMainQueries(sample);
    const expected = [
      ...UNIQUE_INDEXES,
      ...QUERY_INDEXES,
      ...PARTIAL_INDEXES.map((index) => index.name)
    ].sort();

    expect(() => assertQueryCatalog(sample)).not.toThrow();
    expect(queries.map((query) => query.indexName).sort()).toEqual(expected);
    expect(new Set(queries.map((query) => query.table))).toEqual(new Set(QUERY_TABLES));

    for (const query of queries) {
      const text = sqlText(query.statement(sample));

      expect(secretColumnInSql(text)).toBeNull();
      expect(text.startsWith('SELECT "id"')).toBe(true);
      expect(text).not.toContain(sample.userId);
      expect(text).not.toContain(sample.tokenHash);
    }
  });
});
