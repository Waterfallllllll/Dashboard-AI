import { CSRF_HEADER } from "@dashboard/contracts";
import { describe, expect, it, vi } from "vitest";

import { BrowserPushError, saveBrowserPushSubscription } from "./browser-push";

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

const subscription = {
  endpoint: "https://push.example.com/device",
  keys: { p256dh: "a".repeat(32), auth: "b".repeat(16) }
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

describe("сохранение Web Push", () => {
  it("передаёт токен защиты и возвращает идентификатор подписки", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      if (input === "/api/v1/auth/session") {
        return jsonResponse(200, session);
      }

      expect(input).toBe("/api/v1/push/subscriptions");
      expect(init?.method).toBe("POST");
      expect(new Headers(init?.headers).get(CSRF_HEADER)).toBe(session.data.csrfToken);
      expect(JSON.parse(String(init?.body))).toEqual(subscription);
      return jsonResponse(201, {
        data: { id: "01a20e00-fc50-7c11-9c2f-6c067634496a", createdAt: "2026-11-25T12:32:32.044Z" },
        meta: { requestId: "request-1" }
      });
    });

    await expect(saveBrowserPushSubscription(subscription, fetchImpl)).resolves.toBe(
      "01a20e00-fc50-7c11-9c2f-6c067634496a"
    );
  });

  it("сообщает, что нужна сессия", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse(401, {}));

    await expect(saveBrowserPushSubscription(subscription, fetchImpl)).rejects.toMatchObject({
      code: "unauthenticated"
    });
    await expect(saveBrowserPushSubscription(subscription, fetchImpl)).rejects.toBeInstanceOf(
      BrowserPushError
    );
  });
});
