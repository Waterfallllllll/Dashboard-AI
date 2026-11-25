import { describe, expect, it, vi } from "vitest";

import { loadWeatherSection } from "./load-dashboard";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

describe("догрузка погоды", () => {
  it("принимает секцию отдельного запроса", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      expect(input).toBe("/api/v1/weather");
      return jsonResponse(200, {
        data: { status: "unavailable" },
        meta: { requestId: "request-1" }
      });
    });

    await expect(loadWeatherSection(fetchImpl)).resolves.toEqual({ status: "unavailable" });
  });

  it("превращает сбой сети в ошибку секции", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new Error("offline");
    });

    await expect(loadWeatherSection(fetchImpl)).resolves.toMatchObject({ status: "error" });
  });
});
