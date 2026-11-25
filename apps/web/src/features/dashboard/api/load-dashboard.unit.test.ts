import { describe, expect, it, vi } from "vitest";

import { sampleDashboardBody } from "../model/sample-dashboard";

import { DashboardLoadError, loadDashboard } from "./load-dashboard";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

describe("загрузка дашборда", () => {
  it("отдаёт день из ответа сервера", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      expect(input).toBe("/api/v1/dashboard?date=2026-11-24");
      return jsonResponse(200, { data: sampleDashboardBody, meta: { requestId: "request-1" } });
    });

    await expect(loadDashboard("2026-11-24", fetchImpl)).resolves.toMatchObject({
      status: "ready",
      dashboard: { date: "2026-11-24" }
    });
  });

  it("считает ответ 401 отсутствием входа", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse(401, {}));

    await expect(loadDashboard("2026-11-24", fetchImpl)).resolves.toEqual({ status: "anonymous" });
  });

  it("не принимает сломанный ответ", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse(200, { data: {} }));

    await expect(loadDashboard("2026-11-24", fetchImpl)).rejects.toBeInstanceOf(DashboardLoadError);
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
    const pending = loadDashboard("2026-11-24", fetchImpl, controller.signal);

    controller.abort();

    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });
});
