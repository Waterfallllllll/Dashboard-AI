import { describe, expect, it } from "vitest";

import { SECTION_ERROR_MESSAGE, dashboardSchema } from "./dashboard.js";

describe("дашборд", () => {
  it("собирает готовые и недоступные секции и не принимает секрет в ответе", () => {
    const dashboard = {
      date: "2026-11-11",
      generatedAt: "2026-11-11T12:00:00.000Z",
      datetime: {
        status: "ready",
        serverTime: "2026-11-11T12:00:00.000Z",
        timezone: "Europe/Moscow",
        timeFormat: "24"
      },
      widgets: { status: "error", message: SECTION_ERROR_MESSAGE },
      routines: {
        status: "ready",
        day: { date: "2026-11-11", items: [], progress: { done: 0, total: 0 } }
      },
      timer: {
        status: "ready",
        timer: {
          session: null,
          settled: null,
          next: { phase: "work", cycleNumber: 0 },
          completedToday: 0,
          dailyGoal: 8
        }
      },
      weather: { status: "unavailable" },
      calendar: { status: "error", message: SECTION_ERROR_MESSAGE },
      news: { status: "unavailable" }
    };

    expect(dashboardSchema.parse(dashboard).weather.status).toBe("unavailable");
    expect(dashboardSchema.safeParse({ ...dashboard, accessToken: "ya29.secret" }).success).toBe(
      false
    );
  });
});
