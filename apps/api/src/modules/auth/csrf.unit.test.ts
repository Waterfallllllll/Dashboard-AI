import { describe, expect, it } from "vitest";

import { csrfTokenFor, csrfTokensMatch } from "./csrf.js";
import { planGoogleLogin } from "./google-login.js";
import type { UserProfile } from "../users/user-profile.js";

const user: UserProfile = {
  id: "64b7f0c2a1d4e8f01a2b3c4d",
  displayName: "Илья",
  avatarUrl: null,
  locale: "ru",
  timezone: "Europe/Moscow",
  timeFormat: "24",
  theme: "system",
  createdAt: new Date("2026-11-11T12:00:00.000Z"),
  updatedAt: new Date("2026-11-11T12:00:00.000Z")
};

describe("защита сессии", () => {
  it("связывает токен запроса с секретом сессии", () => {
    const token = csrfTokenFor("session-token-value", "session-secret-value-0123456789");
    expect(csrfTokensMatch(token, token)).toBe(true);
    expect(csrfTokensMatch(`${token}x`, token)).toBe(false);
    expect(csrfTokensMatch("short", token)).toBe(false);
  });

  it("не входит в мягко удалённый аккаунт и не затирает имя при повторном входе", () => {
    expect(planGoogleLogin(null, null)).toEqual({ type: "create" });
    expect(planGoogleLogin({ accountId: "account", user: null }, null)).toEqual({
      type: "blocked"
    });
    expect(
      planGoogleLogin({ accountId: "account", user }, "https://lh3.googleusercontent.com/a")
    ).toMatchObject({
      type: "update",
      replaceAvatar: true,
      user
    });
  });
});
