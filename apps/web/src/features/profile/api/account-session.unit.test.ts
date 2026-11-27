import { CSRF_HEADER } from "@dashboard/contracts";
import { describe, expect, it, vi } from "vitest";

import {
  AccountSessionError,
  deleteAccount,
  loadAccountSession,
  signOutAccount,
  visibleAvatarUrl
} from "./account-session";

const session = {
  data: {
    user: {
      id: "64b7f0c2a1d4e8f01a2b3c4d",
      displayName: "Илья",
      avatarUrl: "https://lh3.googleusercontent.com/a/a",
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

describe("сессия профиля", () => {
  it("показывает имя и безопасный аватар", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse(200, session));

    await expect(loadAccountSession(fetchImpl)).resolves.toEqual({
      status: "authenticated",
      displayName: "Илья",
      avatarUrl: "https://lh3.googleusercontent.com/a/a",
      csrfToken: session.data.csrfToken
    });
  });

  it("считает ответ 401 отсутствием входа", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse(401, {}));

    await expect(loadAccountSession(fetchImpl)).resolves.toEqual({ status: "anonymous" });
  });

  it("отбрасывает небезопасный адрес аватара", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse(200, {
        ...session,
        data: {
          ...session.data,
          user: { ...session.data.user, avatarUrl: "javascript:alert(1)" }
        }
      })
    );

    await expect(loadAccountSession(fetchImpl)).resolves.toMatchObject({ avatarUrl: null });
    expect(visibleAvatarUrl("http://example.com/avatar.png")).toBeNull();
  });

  it("не принимает сломанный ответ за сессию", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse(200, { data: {} }));

    await expect(loadAccountSession(fetchImpl)).rejects.toBeInstanceOf(AccountSessionError);
  });

  it("пробрасывает отмену запроса", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn<typeof fetch>(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        })
    );
    const pending = loadAccountSession(fetchImpl, controller.signal);

    controller.abort();

    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });

  it("выходит с токеном защиты", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (_input, init) => {
      expect(init?.method).toBe("POST");
      expect(new Headers(init?.headers).get(CSRF_HEADER)).toBe(session.data.csrfToken);
      return jsonResponse(200, { data: { signedOut: true }, meta: { requestId: "request-2" } });
    });

    await expect(signOutAccount(session.data.csrfToken, fetchImpl)).resolves.toBeUndefined();
  });

  it("удаляет аккаунт с токеном защиты", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      expect(input).toBe("/api/v1/account");
      expect(init?.method).toBe("DELETE");
      expect(new Headers(init?.headers).get(CSRF_HEADER)).toBe(session.data.csrfToken);
      return jsonResponse(200, { data: { deleted: true }, meta: { requestId: "request-2" } });
    });

    await expect(deleteAccount(session.data.csrfToken, fetchImpl)).resolves.toBeUndefined();
  });

  it("не считает сломанный ответ удалением", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse(200, { data: { deleted: false } })
    );

    await expect(deleteAccount(session.data.csrfToken, fetchImpl)).rejects.toMatchObject({
      code: "delete"
    });
  });
});
