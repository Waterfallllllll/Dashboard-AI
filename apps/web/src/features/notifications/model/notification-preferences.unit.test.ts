import { describe, expect, it } from "vitest";

import { isQuietTime, type NotificationPreferences } from "./notification-preferences";

const preferences: NotificationPreferences = {
  workComplete: true,
  breakComplete: true,
  routineReminder: true,
  calendarReminder: false,
  quietStart: "22:00",
  quietEnd: "07:00"
};

describe("notification preferences", () => {
  it("считает тихие часы через полночь", () => {
    expect(isQuietTime(new Date(2026, 10, 4, 23, 15), preferences)).toBe(true);
    expect(isQuietTime(new Date(2026, 10, 4, 12, 0), preferences)).toBe(false);
    expect(isQuietTime(new Date(2026, 10, 4, 6, 59), preferences)).toBe(true);
  });

  it("не включает тихие часы, пока оба края не заданы", () => {
    expect(
      isQuietTime(new Date(2026, 10, 4, 23, 0), {
        ...preferences,
        quietEnd: null
      })
    ).toBe(false);
  });
});
