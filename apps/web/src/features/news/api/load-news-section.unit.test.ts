import { SECTION_ERROR_MESSAGE } from "@dashboard/contracts";
import { describe, expect, it, vi } from "vitest";

import { loadNewsSection } from "./load-news-section";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

describe("запрос раздела новостей", () => {
  it("повторяет чтение лент только по явной просьбе", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      expect(input).toBe("/api/v1/news?refresh=1");
      return jsonResponse(200, {
        data: { status: "empty", updatedAt: "2026-11-25T09:00:00.000Z" },
        meta: { requestId: "request-1" }
      });
    });

    await expect(loadNewsSection({ refresh: true }, fetchImpl)).resolves.toEqual({
      status: "empty",
      updatedAt: "2026-11-25T09:00:00.000Z"
    });
  });

  it("превращает сбой сети в ошибку раздела", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new Error("offline");
    });

    await expect(loadNewsSection({}, fetchImpl)).resolves.toEqual({
      status: "error",
      message: SECTION_ERROR_MESSAGE
    });
  });
});
