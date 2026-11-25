import { CSRF_HEADER } from "@dashboard/contracts";
import { describe, expect, it, vi } from "vitest";

import { TelegramLinkError, createTelegramLink, disconnectTelegram } from "./connect-telegram";

const session = {
  data: {
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
  },
  meta: { requestId: "request-1" }
};

const startToken = "a".repeat(43);
const botUrl = `https://t.me/DashBot?start=${startToken}`;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

describe("привязка Telegram", () => {
  it("передаёт токен защиты и принимает только ссылку бота", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      if (input === "/api/v1/auth/session") {
        return jsonResponse(200, session);
      }

      expect(input).toBe("/api/v1/integrations/telegram/link");
      expect(init?.method).toBe("POST");
      expect(new Headers(init?.headers).get(CSRF_HEADER)).toBe(session.data.csrfToken);
      return jsonResponse(200, {
        data: { url: botUrl, expiresAt: "2026-11-25T12:10:00.000Z" },
        meta: { requestId: "request-2" }
      });
    });

    await expect(createTelegramLink(fetchImpl)).resolves.toEqual({
      url: botUrl,
      expiresAt: "2026-11-25T12:10:00.000Z"
    });
  });

  it("требует вход и отклоняет чужой адрес", async () => {
    const unauthenticated = vi.fn<typeof fetch>(async () => jsonResponse(401, {}));

    await expect(createTelegramLink(unauthenticated)).rejects.toMatchObject({
      code: "unauthenticated"
    });

    const foreign = vi.fn<typeof fetch>(async (input) =>
      input === "/api/v1/auth/session"
        ? jsonResponse(200, session)
        : jsonResponse(200, {
            data: { url: "https://evil.example/start", expiresAt: "2026-11-25T12:10:00.000Z" },
            meta: { requestId: "request-2" }
          })
    );

    await expect(createTelegramLink(foreign)).rejects.toBeInstanceOf(TelegramLinkError);
  });

  it("отключает бота тем же токеном защиты", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      if (input === "/api/v1/auth/session") {
        return jsonResponse(200, session);
      }

      expect(input).toBe("/api/v1/integrations/telegram");
      expect(init?.method).toBe("DELETE");
      expect(new Headers(init?.headers).get(CSRF_HEADER)).toBe(session.data.csrfToken);
      return jsonResponse(200, { data: { deleted: true }, meta: { requestId: "request-2" } });
    });

    await expect(disconnectTelegram(fetchImpl)).resolves.toBeUndefined();
  });
});
