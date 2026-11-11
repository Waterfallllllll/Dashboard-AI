import { describe, expect, it } from "vitest";

import { CSRF_HEADER, sessionSchema } from "./session.js";

const session = {
  user: {
    id: "64b7f0c2a1d4e8f01a2b3c4d",
    displayName: "Илья",
    avatarUrl: null,
    locale: "ru",
    timezone: "Europe/Moscow",
    timeFormat: "24",
    theme: "light",
    createdAt: "2026-11-11T08:30:00.000Z",
    updatedAt: "2026-11-11T08:30:00.000Z"
  },
  expiresAt: "2026-11-25T08:30:00.000Z",
  csrfToken: "a".repeat(43)
};

describe("сессия", () => {
  it("отдаёт профиль, срок и токен защиты запроса без секретов", () => {
    expect(CSRF_HEADER).toBe("X-CSRF-Token");
    expect(sessionSchema.parse(session).user.id).toBe(session.user.id);
    expect(sessionSchema.safeParse({ ...session, refreshToken: "secret" }).success).toBe(false);
    expect(sessionSchema.safeParse({ ...session, csrfToken: "short" }).success).toBe(false);
  });
});
