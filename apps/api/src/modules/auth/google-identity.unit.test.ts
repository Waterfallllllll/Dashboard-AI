import { describe, expect, it } from "vitest";

import { publicDisplayName, readGoogleIdentity, sanitizeAvatarUrl } from "./google-identity.js";
import { assertGoogleAuthorizationUrl, googleCallbackUrl } from "./oauth-request.js";

const now = new Date("2026-11-11T12:00:00.000Z");

describe("профиль Google", () => {
  it("оставляет только openid-профиль и https-аватар Google", () => {
    const identity = readGoogleIdentity({
      subject: "google-user-1",
      emailVerified: true,
      name: "  Илья <b>  ",
      picture: "https://lh3.googleusercontent.com/a/example",
      locale: "ru",
      accessToken: "ya29.access-token",
      refreshToken: "1//refresh-token",
      expiresIn: 3600,
      scope: "openid email profile https://www.googleapis.com/auth/calendar.readonly",
      now
    });

    expect(identity).toMatchObject({
      subject: "google-user-1",
      displayName: "Илья b",
      avatarUrl: "https://lh3.googleusercontent.com/a/example",
      locale: "ru",
      scopes: ["openid", "email", "profile"],
      expiresAt: new Date("2026-11-11T13:00:00.000Z")
    });
    expect(publicDisplayName("")).toBe("Пользователь");
    expect(sanitizeAvatarUrl("http://lh3.googleusercontent.com/a/example")).toBeNull();
    expect(sanitizeAvatarUrl("https://evil.test/a.png")).toBeNull();
  });

  it("отклоняет неподтверждённую почту и подменяет адрес callback", () => {
    expect(
      readGoogleIdentity({
        subject: "google-user-1",
        emailVerified: false,
        name: "Илья",
        picture: null,
        locale: "ru",
        accessToken: "ya29.access-token",
        refreshToken: null,
        expiresIn: 3600,
        scope: "openid",
        now
      })
    ).toBeNull();

    const callback = googleCallbackUrl(
      "http://localhost:3000/api/v1/auth/google/callback",
      new URLSearchParams({
        code: "abc",
        state: "state",
        redirect_uri: "https://evil.test/steal"
      })
    );

    expect(callback.origin).toBe("http://localhost:3000");
    expect(callback.pathname).toBe("/api/v1/auth/google/callback");
    expect(callback.searchParams.get("code")).toBe("abc");
    expect(callback.searchParams.has("redirect_uri")).toBe(false);
    expect(() => assertGoogleAuthorizationUrl("https://evil.test/auth")).toThrow(/Google/);
  });
});
