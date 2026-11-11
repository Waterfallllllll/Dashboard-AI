import { describe, expect, it } from "vitest";

import { profilePatchSchema, profileSchema } from "./profile.js";

const profile = {
  id: "64b7f0c2a1d4e8f01a2b3c4d",
  displayName: "Илья",
  avatarUrl: null,
  locale: "ru",
  timezone: "Europe/Moscow",
  timeFormat: "24",
  theme: "system",
  createdAt: "2026-11-11T08:30:00.000Z",
  updatedAt: "2026-11-11T08:30:00.000Z"
};

describe("профиль", () => {
  it("принимает профиль и частичное изменение", () => {
    expect(profileSchema.parse(profile).displayName).toBe("Илья");
    expect(profilePatchSchema.parse({ displayName: "  Аня  ", theme: "dark" })).toEqual({
      displayName: "Аня",
      theme: "dark"
    });
  });

  it("не принимает секрет, аватар и пустое изменение", () => {
    expect(profileSchema.safeParse({ ...profile, accessToken: "ya29.secret" }).success).toBe(false);
    expect(profilePatchSchema.safeParse({ avatarUrl: "https://example.test/a" }).success).toBe(
      false
    );
    expect(profilePatchSchema.safeParse({}).success).toBe(false);
    expect(profilePatchSchema.safeParse({ displayName: "<script>" }).success).toBe(false);
    expect(profilePatchSchema.safeParse({ timezone: "auto" }).success).toBe(false);
  });
});
