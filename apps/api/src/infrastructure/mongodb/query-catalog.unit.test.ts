import { describe, expect, it } from "vitest";

import { INDEX_DEFINITIONS } from "./index-catalog.js";
import { assertQueryCatalog, buildMainQueries, createQuerySample } from "./query-catalog.js";

describe("каталог основных запросов", () => {
  it("связывает каждый unique- и query-индекс с одним запросом", () => {
    expect(() => assertQueryCatalog()).not.toThrow();
    const queries = buildMainQueries(createQuerySample());
    const indexed = INDEX_DEFINITIONS.filter((index) => index.kind !== "ttl").map(
      (index) => index.name
    );

    expect(queries.map((query) => query.indexName).sort()).toEqual([...indexed].sort());
    expect(queries.some((query) => query.collection === "users")).toBe(false);
    expect(queries.find((query) => query.name === "routines-by-user-status")?.filter).toMatchObject(
      { deletedAt: null, status: "active" }
    );
    expect(queries.find((query) => query.name === "timer-active")?.filter).toMatchObject({
      completedAt: null
    });
    expect(queries.find((query) => query.name === "timer-history")).toMatchObject({
      sort: { startedAt: -1 },
      limit: 20,
      indexProvidesOrder: true
    });
    expect(queries.find((query) => query.name === "news-feed")).toMatchObject({
      sort: { publishedAt: -1 },
      indexName: "news_items_published_topics_language"
    });
  });
});
