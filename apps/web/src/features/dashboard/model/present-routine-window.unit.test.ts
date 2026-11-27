import { dashboardSchema } from "@dashboard/contracts";
import { describe, expect, it } from "vitest";

import { presentDashboard } from "./present-dashboard";
import { sampleDashboardBody } from "./sample-dashboard";

describe("рутины на завтра", () => {
  it("раскладывает бесконечную рутину на завтра, а однодневную оставляет на сегодня", () => {
    const today = sampleDashboardBody.routines.day;
    const tomorrowItem = {
      id: "64b7f0c2a1d4e8f01a2b3c60",
      ruleId: "64b7f0c2a1d4e8f01a2b3c61",
      localDate: "2026-11-25",
      title: "Front-End",
      status: "pending" as const,
      completedAt: null
    };
    const dashboard = dashboardSchema.parse({
      ...sampleDashboardBody,
      routines: {
        status: "ready",
        day: today,
        days: [
          { date: "2026-11-23", items: [], progress: { done: 0, total: 0 } },
          today,
          {
            date: "2026-11-25",
            items: [tomorrowItem],
            progress: { done: 0, total: 1 }
          }
        ]
      }
    });

    const view = presentDashboard(dashboard, "Europe/Moscow");

    expect(view.routines.data.filter((item) => item.dayOffset === 0).map((item) => item.title)).toEqual([
      "Выпить 1 литр воды",
      "Погладить кота",
      "Сделать зарядку"
    ]);
    expect(view.routines.data.filter((item) => item.dayOffset === 1).map((item) => item.title)).toEqual([
      "Front-End"
    ]);
    expect(view.routines.status).toBe("success");
  });
});
