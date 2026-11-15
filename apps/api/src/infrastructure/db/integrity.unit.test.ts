import { describe, expect, it } from "vitest";

import { collectWidgetViolations, integrityStatementText } from "./integrity.js";
import { secretColumnInSql } from "./query-catalog.js";

describe("целостность без чтения секретов", () => {
  it("ищет повтор типа и позиции виджета внутри одного пользователя", () => {
    const violations = collectWidgetViolations([
      { id: "a", user_id: "user-1", widget_type: "news", position: 0 },
      { id: "b", user_id: "user-1", widget_type: "news", position: 1 },
      { id: "c", user_id: "user-1", widget_type: "timer", position: 0 },
      { id: "d", user_id: "user-2", widget_type: "news", position: 0 }
    ]);

    expect(violations.map((violation) => violation.code)).toEqual([
      "DUPLICATE_WIDGET",
      "DUPLICATE_WIDGET_POSITION"
    ]);
  });

  it("не выбирает токены, credentials и ключи push", () => {
    for (const sql of integrityStatementText()) {
      expect(secretColumnInSql(sql)).toBeNull();
    }
  });
});
