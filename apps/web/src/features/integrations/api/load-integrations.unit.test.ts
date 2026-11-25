import { describe, expect, it, vi } from "vitest";

import {
  calendarCardStatus,
  loadBrowserGoogleCalendarStatus,
  loadGoogleCalendarStatus
} from "./load-integrations";

const connectedBody = {
  data: {
    integrations: [
      {
        type: "google_calendar",
        status: "connected",
        lastSyncAt: "2026-11-25T12:32:32.044Z"
      },
      { type: "telegram", status: "disconnected", lastSyncAt: null }
    ]
  },
  meta: { requestId: "request-1" }
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

describe("статус Google Calendar", () => {
  it("читает connected и передаёт cookie сессии на API", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse(200, connectedBody));

    await expect(
      loadGoogleCalendarStatus("http://localhost:4000", "session=abc", fetchImpl)
    ).resolves.toBe("connected");

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBeInstanceOf(URL);
    expect(String(url)).toBe("http://localhost:4000/api/v1/integrations");
    expect(new Headers(init?.headers).get("Cookie")).toBe("session=abc");
    expect(init?.cache).toBe("no-store");
  });

  it("не считает календарь подключённым, если сессия или ответ недоступны", async () => {
    const unauthorized = vi.fn<typeof fetch>(async () => jsonResponse(401, {}));
    const broken = vi.fn<typeof fetch>(async () => {
      throw new Error("network");
    });

    await expect(loadGoogleCalendarStatus("http://localhost:4000", "", unauthorized)).resolves.toBe(
      null
    );
    await expect(
      loadGoogleCalendarStatus("http://localhost:4000", "session=abc", broken)
    ).resolves.toBe(null);
  });

  it("оставляет подключение после перезагрузки и показывает разовую ошибку только без связи", () => {
    expect(calendarCardStatus("connected", null)).toBe("connected");
    expect(calendarCardStatus("connected", "cancelled")).toBe("connected");
    expect(calendarCardStatus("disconnected", null)).toBeNull();
    expect(calendarCardStatus(null, "error")).toBe("error");
    expect(calendarCardStatus(null, "connected")).toBe("connected");
  });

  it("в браузере читает статус через ту же сессию, без отдельной cookie", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse(200, connectedBody));

    await expect(loadBrowserGoogleCalendarStatus(fetchImpl)).resolves.toBe("connected");

    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe("/api/v1/integrations");
    expect(init?.credentials).toBe("same-origin");
  });
});
