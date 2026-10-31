import { describe, expect, it } from "vitest";

import { capitalizeRu, formatClock, getTimeZoneLabel } from "./format-clock";

const moscowMorning = Date.UTC(2026, 9, 31, 8, 42, 7);

describe("formatClock", () => {
  it("собирает время, дату и подпись пояса", () => {
    expect(
      formatClock({
        now: moscowMorning,
        timeZone: "Europe/Moscow",
        systemTimeZone: "UTC",
        timeFormat: "24"
      })
    ).toEqual({
      time: "11:42:07",
      date: "Суббота, 31 октября",
      timeZoneLabel: "Москва",
      showTimeZone: true
    });
  });

  it("скрывает пояс, если он совпадает с системным", () => {
    const clock = formatClock({
      now: moscowMorning,
      timeZone: "Europe/Moscow",
      systemTimeZone: "Europe/Moscow",
      timeFormat: "12"
    });

    expect(clock.showTimeZone).toBe(false);
    expect(clock.time).toMatch(/11:42:07/);
    expect(getTimeZoneLabel("Pacific/Auckland")).toBe("Pacific/Auckland");
    expect(capitalizeRu("суббота")).toBe("Суббота");
  });
});
