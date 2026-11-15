import { describe, expect, it } from "vitest";

import {
  INDEX_USED_REASON,
  SMALL_TABLE_MAX_ROWS,
  SMALL_TABLE_REASON,
  assessPostgresPlan,
  decideQueryPlan,
  readExplainPlan,
  type ExplainAssessment
} from "./explain-plan.js";

const naturalFailure = assessment(false, "Seq Scan");

describe("разбор плана PostgreSQL", () => {
  it("принимает индексный просмотр и отклоняет последовательный и чужой индекс", () => {
    expect(
      assessPostgresPlan(
        { "Node Type": "Index Scan", "Index Name": "sessions_token_hash" },
        "sessions_token_hash",
        false
      )
    ).toMatchObject({ ok: true, reason: INDEX_USED_REASON });
    expect(
      assessPostgresPlan(
        {
          "Node Type": "Bitmap Heap Scan",
          Plans: [{ "Node Type": "Bitmap Index Scan", "Index Name": "news_items_topics" }]
        },
        "news_items_topics",
        false
      ).ok
    ).toBe(true);
    expect(assessPostgresPlan({ "Node Type": "Seq Scan" }, "sessions_token_hash", false).ok).toBe(
      false
    );
    expect(
      assessPostgresPlan(
        { "Node Type": "Index Scan", "Index Name": "other_index" },
        "sessions_token_hash",
        false
      ).ok
    ).toBe(false);
  });

  it("требует порядок от индекса и читает JSON плана", () => {
    const sorted = {
      "Node Type": "Sort",
      Plans: [{ "Node Type": "Index Scan", "Index Name": "timer_sessions_user_started_at" }]
    };

    expect(assessPostgresPlan(sorted, "timer_sessions_user_started_at", true).ok).toBe(false);
    expect(assessPostgresPlan(sorted, "timer_sessions_user_started_at", false).ok).toBe(true);
    expect(
      readExplainPlan([
        {
          "QUERY PLAN": [
            {
              Plan: {
                "Node Type": "Limit",
                Plans: [{ "Node Type": "Index Only Scan", "Index Name": "sessions_token_hash" }]
              }
            }
          ]
        }
      ])
    ).toMatchObject({ "Node Type": "Limit" });
  });

  it("на малой таблице принимает принудительный план и не маскирует большую таблицу", () => {
    const forced = assessment(true, INDEX_USED_REASON);

    expect(
      decideQueryPlan({
        natural: naturalFailure,
        forced,
        ordered: null,
        proved: null,
        rowCount: SMALL_TABLE_MAX_ROWS - 1,
        indexExists: true
      }).reason
    ).toBe(SMALL_TABLE_REASON);
    expect(
      decideQueryPlan({
        natural: naturalFailure,
        forced,
        ordered: null,
        proved: null,
        rowCount: SMALL_TABLE_MAX_ROWS,
        indexExists: true
      })
    ).toBe(naturalFailure);
    expect(
      decideQueryPlan({
        natural: naturalFailure,
        forced: null,
        ordered: null,
        proved: null,
        rowCount: 0,
        indexExists: false
      }).reason
    ).toBe("индекс отсутствует в pg_indexes");
  });
});

function assessment(ok: boolean, reason: string): ExplainAssessment {
  return {
    ok,
    sorted: false,
    seqScan: !ok,
    indexNames: ok ? ["sessions_token_hash"] : [],
    stages: ok ? ["Index Scan"] : ["Seq Scan"],
    reason
  };
}
