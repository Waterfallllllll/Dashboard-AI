import { describe, expect, it } from "vitest";

import { DEFAULT_CLOCK_PREFERENCES, resolveTimeZone } from "./clock-preferences";

describe("clock preferences", () => {
  it("оставляет выбранный пояс без изменений", () => {
    expect(resolveTimeZone("Europe/Moscow")).toBe("Europe/Moscow");
    expect(DEFAULT_CLOCK_PREFERENCES).toEqual({ timezone: "auto", timeFormat: "24" });
  });
});
