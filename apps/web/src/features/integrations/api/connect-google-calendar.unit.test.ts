import { CSRF_HEADER } from "@dashboard/contracts";
import { describe, expect, it, vi } from "vitest";

import { CalendarConnectError, connectGoogleCalendar } from "./connect-google-calendar";

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

const googleUrl = "https://accounts.google.com/o/oauth2/v2/auth?state=calendar-state";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

describe("подключение Google Calendar", () => {
  it("передаёт токен защиты и возвращает только адрес Google", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      if (input === "/api/v1/auth/session") {
        return jsonResponse(200, session);
      }

      expect(input).toBe("/api/v1/integrations/google/connect");
      expect(init?.method).toBe("POST");
      expect(new Headers(init?.headers).get(CSRF_HEADER)).toBe(session.data.csrfToken);
      return jsonResponse(200, { data: { url: googleUrl }, meta: { requestId: "request-2" } });
    });

    await expect(connectGoogleCalendar(fetchImpl)).resolves.toBe(googleUrl);
  });

  it("требует вход и отклоняет чужой адрес", async () => {
    const unauthenticated = vi.fn<typeof fetch>(async () => jsonResponse(401, {}));

    await expect(connectGoogleCalendar(unauthenticated)).rejects.toMatchObject({
      code: "unauthenticated"
    });

    const foreign = vi.fn<typeof fetch>(async (input) =>
      input === "/api/v1/auth/session"
        ? jsonResponse(200, session)
        : jsonResponse(200, {
            data: { url: "https://evil.example/oauth" },
            meta: { requestId: "request-2" }
          })
    );

    await expect(connectGoogleCalendar(foreign)).rejects.toBeInstanceOf(CalendarConnectError);
  });
});
