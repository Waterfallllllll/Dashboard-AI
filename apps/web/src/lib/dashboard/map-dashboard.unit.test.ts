import type { Dashboard, RoutineDay, TimerSnapshot } from "@dashboard/contracts";
import { describe, expect, it } from "vitest";

import { mapDashboard } from "./map-dashboard";

const NOW = "2026-11-15T09:00:00.000Z";

describe("mapDashboard", () => {
  it("переводит недоступные внешние секции в состояния карточек", () => {
    const view = mapDashboard({
      date: "2026-11-15",
      timeZone: "Europe/Moscow",
      timeFormat: "24",
      dashboard: dashboardFixture(),
      yesterday: null,
      tomorrow: null
    });

    expect(view.states.weather).toBe("permission-required");
    expect(view.states.calendar).toBe("disconnected");
    expect(view.states.news).toBe("empty");
    expect(view.states.routines).toBe("success");
    expect(view.routineItems).toEqual([
      {
        id: "00000000-0000-4000-8000-000000000001",
        title: "Зарядка",
        dayOffset: 0,
        done: true
      }
    ]);
    expect(view.weather).toBeNull();
  });

  it("оставляет ошибку одной секции, не стирая остальные", () => {
    const source = dashboardFixture();
    const view = mapDashboard({
      date: "2026-11-15",
      timeZone: "Europe/Moscow",
      timeFormat: "24",
      dashboard: {
        ...source,
        news: { status: "error", message: "Не удалось загрузить раздел." },
        timer: { status: "error", message: "Не удалось загрузить раздел." }
      },
      yesterday: emptyDay("2026-11-14"),
      tomorrow: emptyDay("2026-11-16")
    });

    expect(view.states.news).toBe("error");
    expect(view.states.timer).toBe("error");
    expect(view.states.routines).toBe("success");
    expect(view.newsItems).toBeNull();
    expect(view.timer).toBeNull();
  });
});

function emptyDay(date: string): RoutineDay {
  return { date, items: [], progress: { done: 0, total: 0 } };
}

function dashboardFixture(): Dashboard {
  const timer: TimerSnapshot = {
    session: null,
    settled: null,
    next: { phase: "work", cycleNumber: 0 },
    completedToday: 0,
    dailyGoal: 8
  };

  return {
    date: "2026-11-15",
    generatedAt: NOW,
    datetime: {
      status: "ready",
      serverTime: NOW,
      timezone: "Europe/Moscow",
      timeFormat: "24"
    },
    widgets: { status: "error", message: "Не удалось загрузить раздел." },
    routines: {
      status: "ready",
      day: {
        date: "2026-11-15",
        items: [
          {
            id: "00000000-0000-4000-8000-000000000001",
            ruleId: "00000000-0000-4000-8000-000000000002",
            localDate: "2026-11-15",
            title: "Зарядка",
            status: "done",
            completedAt: NOW
          }
        ],
        progress: { done: 1, total: 1 }
      }
    },
    timer: { status: "ready", timer },
    weather: { status: "unavailable" },
    calendar: { status: "unavailable" },
    news: { status: "empty", updatedAt: null }
  };
}
