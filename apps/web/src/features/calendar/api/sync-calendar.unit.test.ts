import { CSRF_HEADER } from "@dashboard/contracts";
import { describe, expect, it, vi } from "vitest";

import { CalendarSyncError, syncCalendar } from "./sync-calendar";

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

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

describe("синхронизация календаря", () => {
  it("передаёт токен защиты и дату дня", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      if (input === "/api/v1/auth/session") {
        return jsonResponse(200, session);
      }

      expect(input).toBe("/api/v1/calendar/sync?date=2026-11-25");
      expect(init?.method).toBe("POST");
      expect(new Headers(init?.headers).get(CSRF_HEADER)).toBe(session.data.csrfToken);
      return jsonResponse(200, {
        data: { status: "empty" },
        meta: { requestId: "request-2" }
      });
    });

    await expect(syncCalendar("2026-11-25", fetchImpl)).resolves.toEqual({ status: "empty" });
  });

  it("отличает отсутствие календаря от сбоя и не шлёт кривую дату", async () => {
    const missing = vi.fn<typeof fetch>(async (input) =>
      input === "/api/v1/auth/session" ? jsonResponse(200, session) : jsonResponse(404, {})
    );

    await expect(syncCalendar("2026-11-25", missing)).rejects.toMatchObject({
      code: "missing"
    });

    const idle = vi.fn<typeof fetch>();

    await expect(syncCalendar("завтра", idle)).rejects.toBeInstanceOf(CalendarSyncError);
    expect(idle).not.toHaveBeenCalled();
  });
});
