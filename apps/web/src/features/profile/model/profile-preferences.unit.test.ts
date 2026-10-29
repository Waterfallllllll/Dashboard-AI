import { describe, expect, it } from "vitest";

import { parseStoredPreferences } from "./profile-preferences";

describe("parseStoredPreferences", () => {
  it("читает валидные локальные предпочтения", () => {
    expect(
      parseStoredPreferences(JSON.stringify({ timezone: "Europe/Moscow", timeFormat: "12" }))
    ).toEqual({
      timezone: "Europe/Moscow",
      timeFormat: "12"
    });
  });

  it("отбрасывает повреждённый JSON и неполные данные", () => {
    expect(parseStoredPreferences("{")).toBeNull();
    expect(parseStoredPreferences(JSON.stringify({ timezone: "Europe/Moscow" }))).toBeNull();
    expect(
      parseStoredPreferences(JSON.stringify({ timezone: "Mars/Phobos", timeFormat: "24" }))
    ).toBeNull();
    expect(parseStoredPreferences(null)).toBeNull();
  });
});
