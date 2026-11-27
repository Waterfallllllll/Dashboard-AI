import { CSRF_HEADER, IDEMPOTENCY_KEY_HEADER } from "@dashboard/contracts";
import { describe, expect, it, vi } from "vitest";

import { RoutineRulesError, createRoutineRule, listRoutineRules } from "./routine-rules-client";

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

function rule(id: string, title: string) {
  return {
    id,
    title,
    description: null,
    startDate: "2026-11-01",
    endDate: null,
    recurrence: { kind: "daily" },
    reminderLocalTime: "08:00",
    timezone: "Europe/Moscow",
    status: "active",
    createdAt: "2026-11-01T05:00:00.000Z",
    updatedAt: "2026-11-01T05:00:00.000Z"
  };
}

const first = rule("550e8400-e29b-41d4-a716-446655440000", "Утренняя зарядка");
const second = rule("550e8400-e29b-41d4-a716-446655440001", "Вечерняя прогулка");

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

describe("клиент правил рутин", () => {
  it("читает все страницы списка", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);

      if (url === "/api/v1/routine-rules?limit=100") {
        return jsonResponse(200, {
          data: [first],
          meta: { requestId: "request-1", page: { nextCursor: first.id } }
        });
      }

      expect(url).toBe(`/api/v1/routine-rules?limit=100&cursor=${encodeURIComponent(first.id)}`);
      return jsonResponse(200, {
        data: [second],
        meta: { requestId: "request-2", page: { nextCursor: null } }
      });
    });

    await expect(listRoutineRules(fetchImpl)).resolves.toEqual([first, second]);
  });

  it("создаёт рутину с токеном защиты и ключом идемпотентности", async () => {
    const draft = {
      title: "Вечерняя прогулка",
      description: null,
      startDate: "2026-11-27",
      endDate: null,
      recurrence: { kind: "daily" as const },
      reminderLocalTime: null,
      status: "active" as const
    };
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      if (input === "/api/v1/auth/session") {
        return jsonResponse(200, session);
      }

      expect(input).toBe("/api/v1/routine-rules");
      expect(init?.method).toBe("POST");
      expect(new Headers(init?.headers).get(CSRF_HEADER)).toBe(session.data.csrfToken);
      expect(new Headers(init?.headers).get(IDEMPOTENCY_KEY_HEADER)).toBe("routine-create-01");
      expect(JSON.parse(String(init?.body))).toEqual(draft);
      return jsonResponse(201, { data: second, meta: { requestId: "request-2" } });
    });

    await expect(createRoutineRule(draft, "routine-create-01", fetchImpl)).resolves.toEqual(second);
  });

  it("требует вход и не отправляет короткий ключ", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse(401, {}));
    const draft = {
      title: "Вечерняя прогулка",
      startDate: "2026-11-27",
      recurrence: { kind: "once" as const }
    };

    await expect(listRoutineRules(fetchImpl)).rejects.toMatchObject({ code: "unauthenticated" });
    await expect(createRoutineRule(draft, "short", fetchImpl)).rejects.toBeInstanceOf(RoutineRulesError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
