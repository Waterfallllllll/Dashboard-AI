import { describe, expect, it } from "vitest";

import { devicePreferencesFromApi } from "./device-preferences";

describe("devicePreferencesFromApi", () => {
  it("берёт канал браузера и тихие часы из ответа API", () => {
    expect(
      devicePreferencesFromApi({
        work: { browser: false, telegram: true },
        break: { browser: true, telegram: false },
        routine: { browser: true, telegram: true },
        calendar: { browser: false, telegram: false },
        quietStart: "22:00",
        quietEnd: "07:00"
      })
    ).toEqual({
      workComplete: false,
      breakComplete: true,
      routineReminder: true,
      calendarReminder: false,
      quietStart: "22:00",
      quietEnd: "07:00"
    });
  });
});
