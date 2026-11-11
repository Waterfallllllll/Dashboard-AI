import { describe, expect, it } from "vitest";

import { COLLECTION_NAMES } from "./collection-catalog.js";
import { widgetShapeViolations } from "./integrity.js";
import {
  GLOBAL_COLLECTIONS,
  TRANSIENT_COLLECTIONS,
  USER_OWNED_COLLECTIONS,
  assertUserDataCoverage
} from "./user-data.js";

describe("границы данных пользователя", () => {
  it("относит каждую коллекцию к пользователю или к общему кэшу", () => {
    expect(() => assertUserDataCoverage(COLLECTION_NAMES)).not.toThrow();
    expect(GLOBAL_COLLECTIONS).toEqual(["news_items"]);
    expect(TRANSIENT_COLLECTIONS).toEqual(["one_time_tokens"]);
    expect(USER_OWNED_COLLECTIONS).not.toContain("news_items");
    expect(USER_OWNED_COLLECTIONS).not.toContain("one_time_tokens");
    expect(USER_OWNED_COLLECTIONS).not.toContain("users");
    expect(() => assertUserDataCoverage([...COLLECTION_NAMES, "calendar_events"])).toThrow(
      /общему кэшу/
    );
  });

  it("находит повтор типа и позиции виджета", () => {
    expect(widgetShapeViolations([{ widgetType: "timer", position: 0 }])).toEqual([]);
    expect(
      widgetShapeViolations([
        { widgetType: "timer", position: 0 },
        { widgetType: "timer", position: 0 }
      ])
    ).toEqual(["DUPLICATE_WIDGET", "DUPLICATE_WIDGET_POSITION"]);
    expect(widgetShapeViolations([null])).toEqual(["INVALID_WIDGET"]);
  });
});
