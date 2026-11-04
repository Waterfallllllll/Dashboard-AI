import { describe, expect, it } from "vitest";

import { locationFromCoordinates, parseCity, reduceCoordinate } from "./device-location";

describe("device location", () => {
  it("сокращает координаты до двух знаков и отклоняет выход за диапазон", () => {
    expect(reduceCoordinate(55.7558)).toBe(55.76);
    expect(locationFromCoordinates(55.7558, 37.6173)).toEqual({
      kind: "coordinates",
      latitude: 55.76,
      longitude: 37.62
    });
    expect(locationFromCoordinates(120, 10)).toBeNull();
  });

  it("обрезает город и убирает управляющие символы", () => {
    expect(parseCity("  Казань \n")).toBe("Казань");
    expect(parseCity(" ")).toBeNull();
    expect(parseCity("а".repeat(81))).toBeNull();
  });
});
