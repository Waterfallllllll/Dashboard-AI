import { describe, expect, it } from "vitest";

import {
  addDays,
  localClockMinutes,
  localDateInTimeZone,
  weekday,
  zonedDayBounds,
  zonedLocalDateTime
} from "./local-date.js";

describe("локальные даты", () => {
  it("сдвигает календарную дату без перехода на соседний день из-за UTC", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(weekday("2024-01-01")).toBe(1);
  });

  it("берёт сегодня и границы суток в часовом поясе пользователя", () => {
    expect(localDateInTimeZone(new Date("2026-11-10T21:30:00.000Z"), "Europe/Moscow")).toBe(
      "2026-11-11"
    );
    expect(localDateInTimeZone(new Date("2026-11-10T20:30:00.000Z"), "Europe/Moscow")).toBe(
      "2026-11-10"
    );
    expect(zonedDayBounds("2026-11-11", "Europe/Moscow")).toEqual({
      from: new Date("2026-11-10T21:00:00.000Z"),
      to: new Date("2026-11-11T21:00:00.000Z")
    });
    expect(zonedDayBounds("2026-11-11", "America/New_York")).toEqual({
      from: new Date("2026-11-11T05:00:00.000Z"),
      to: new Date("2026-11-12T05:00:00.000Z")
    });
    expect(zonedLocalDateTime("2026-11-11", "09:00", "Europe/Moscow").toISOString()).toBe(
      "2026-11-11T06:00:00.000Z"
    );
    expect(localClockMinutes(new Date("2026-11-10T21:30:00.000Z"), "Europe/Moscow")).toBe(30);
  });
});
