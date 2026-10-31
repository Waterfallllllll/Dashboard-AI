import { describe, expect, it } from "vitest";

import { formatInZone, formatUpdatedAt, toZonedDate } from "./date-time";

const moscowMorning = Date.UTC(2026, 9, 31, 8, 42, 7);

describe("formatInZone", () => {
  it("переводит UTC-момент в выбранный пояс", () => {
    expect(formatInZone(moscowMorning, "Europe/Moscow", "HH:mm:ss")).toBe("11:42:07");
    expect(toZonedDate(moscowMorning, "Europe/Moscow").getHours()).toBe(11);
  });

  it("подписывает обновление относительно календарного дня пользователя", () => {
    expect(formatUpdatedAt(moscowMorning, moscowMorning + 5 * 60 * 1000, "Europe/Moscow")).toBe(
      "сегодня в 11:42"
    );
    expect(
      formatUpdatedAt(moscowMorning - 24 * 60 * 60 * 1000, moscowMorning, "Europe/Moscow")
    ).toMatch(/в 11:42$/);
  });
});
