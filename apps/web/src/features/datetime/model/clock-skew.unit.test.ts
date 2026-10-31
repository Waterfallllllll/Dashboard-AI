import { describe, expect, it } from "vitest";

import { CLOCK_SKEW_THRESHOLD_MS, getMockServerNow, hasClockSkew } from "./clock-skew";

describe("hasClockSkew", () => {
  it("не предупреждает при расхождении до минуты", () => {
    expect(hasClockSkew(1_000, 1_000 + CLOCK_SKEW_THRESHOLD_MS)).toBe(false);
    expect(hasClockSkew(1_000, getMockServerNow(1_000))).toBe(false);
  });

  it("предупреждает, если разница больше 60 секунд", () => {
    expect(hasClockSkew(1_000, 1_000 + CLOCK_SKEW_THRESHOLD_MS + 1)).toBe(true);
  });
});
