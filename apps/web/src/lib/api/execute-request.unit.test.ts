import { apiSuccessSchema } from "@dashboard/contracts";
import { z } from "zod";
import { afterEach, describe, expect, it, vi } from "vitest";

import { executeRequest } from "./execute-request";

const sampleSchema = apiSuccessSchema(z.strictObject({ ready: z.literal(true) }));

describe("executeRequest", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("проверяет успешный ответ схемой и добавляет идентификатор запроса", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: { ready: true },
        meta: { requestId: "request-123456" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await executeRequest({
      url: "http://127.0.0.1:4000/api/v1/auth/session",
      method: "GET",
      schema: sampleSchema
    });

    expect(result.ok).toBe(true);
    expect(result.requestId).toBe("request-123456");
    const headers = new Headers(fetchMock.mock.calls[0]?.[1].headers as Headers);
    expect(headers.get("X-Request-Id")).toMatch(/^[A-Za-z0-9_-]{8,80}$/);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("не повторяет изменяющий запрос и передаёт ключ идемпотентности", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await executeRequest({
      url: "http://127.0.0.1:4000/api/v1/routine-rules",
      method: "POST",
      schema: sampleSchema,
      body: { title: "Зарядка" },
      idempotencyKey: "routine-key-1",
      csrfToken: "csrf-token-value-0123456789abcdef"
    });

    expect(result.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledOnce();
    const headers = new Headers(fetchMock.mock.calls[0]?.[1].headers as Headers);
    expect(headers.get("Idempotency-Key")).toBe("routine-key-1");
    expect(headers.get("X-CSRF-Token")).toBe("csrf-token-value-0123456789abcdef");
  });

  it("не включает сырой ответ в сообщение, если схема не сошлась", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(200, {
          data: { secret: "ya29.token-value" },
          meta: { requestId: "request-123456" }
        })
      )
    );

    const result = await executeRequest({
      url: "http://127.0.0.1:4000/api/v1/profile",
      method: "GET",
      schema: sampleSchema
    });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.message).not.toContain("ya29");
      expect(result.message).not.toContain("secret");
    }
  });
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
