import { describe, expect, it } from "vitest";

import {
  INDEX_USED_REASON,
  PLANNER_SAMPLE_MIN_DOCUMENTS,
  SMALL_COLLECTION_REASON,
  assessExplainDocument,
  decideExplainResult
} from "./explain-query.js";

describe("разбор explain", () => {
  it("принимает IXSCAN ожидаемого индекса и отклоняет полный просмотр", () => {
    const used = assessExplainDocument(
      plan({
        stage: "FETCH",
        inputStage: { stage: "IXSCAN", indexName: "sessions_token_hash" }
      }),
      "sessions_token_hash",
      false
    );

    expect(used).toMatchObject({
      ok: true,
      reason: INDEX_USED_REASON,
      stages: ["FETCH", "IXSCAN"]
    });
    expect(
      assessExplainDocument(plan({ stage: "COLLSCAN" }), "sessions_token_hash", false).ok
    ).toBe(false);
    expect(
      assessExplainDocument(
        plan({ stage: "IXSCAN", indexName: "other_index" }),
        "sessions_token_hash",
        false
      ).ok
    ).toBe(false);
  });

  it("требует порядок от индекса и читает вложенный queryPlan", () => {
    const blockingSort = assessExplainDocument(
      plan({
        stage: "SORT",
        inputStage: { stage: "IXSCAN", indexName: "timer_sessions_user_started_at" }
      }),
      "timer_sessions_user_started_at",
      true
    );
    const samePlanWithoutSortRequirement = assessExplainDocument(
      plan({
        stage: "SORT",
        inputStage: { stage: "IXSCAN", indexName: "timer_sessions_user_started_at" }
      }),
      "timer_sessions_user_started_at",
      false
    );

    expect(blockingSort.ok).toBe(false);
    expect(blockingSort.reason).toMatch(/сортировка/);
    expect(samePlanWithoutSortRequirement.ok).toBe(true);
    expect(
      assessExplainDocument(
        plan({
          queryPlan: {
            stage: "LIMIT",
            inputStage: {
              stage: "IXSCAN",
              indexName: "news_items_published_topics_language"
            }
          }
        }),
        "news_items_published_topics_language",
        true
      ).ok
    ).toBe(true);
    expect(
      assessExplainDocument(
        { queryPlanner: { winningPlan: { stage: "IXSCAN", indexName: "sessions_token_hash" } } },
        "sessions_token_hash",
        false
      ).ok
    ).toBe(false);
  });

  it("на маленькой коллекции принимает пригодный индекс, если планировщик выбрал просмотр", () => {
    const unhinted = assessExplainDocument(
      plan({ stage: "COLLSCAN" }),
      "news_items_content_hash",
      false
    );
    const hinted = assessExplainDocument(
      plan({ stage: "IXSCAN", indexName: "news_items_content_hash" }),
      "news_items_content_hash",
      false
    );

    expect(decideExplainResult(hinted, null, 1)).toMatchObject({
      ok: true,
      reason: INDEX_USED_REASON
    });
    expect(decideExplainResult(unhinted, hinted, PLANNER_SAMPLE_MIN_DOCUMENTS - 1)).toMatchObject({
      ok: true,
      reason: SMALL_COLLECTION_REASON
    });
    expect(decideExplainResult(unhinted, hinted, PLANNER_SAMPLE_MIN_DOCUMENTS).ok).toBe(false);
    expect(decideExplainResult(unhinted, null, 1).ok).toBe(false);
  });
});

function plan(winningPlan: unknown, executionSuccess = true) {
  return {
    queryPlanner: { winningPlan },
    executionStats: { executionSuccess }
  };
}
