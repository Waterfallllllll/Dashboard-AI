import { dashboardSchema, type Dashboard } from "@dashboard/contracts";
import { describe, expect, it } from "vitest";

import { presentDashboard } from "./present-dashboard";
import { sampleDashboardBody } from "./sample-dashboard";

const dashboard = dashboardSchema.parse(sampleDashboardBody);

describe("представление дашборда", () => {
  it("переводит ответ сервера в данные карточек", () => {
    const view = presentDashboard(dashboard, "Europe/Moscow");

    expect(view.weather).toMatchObject({
      status: "success",
      data: { locationLabel: "Москва", temperatureC: 11, scene: "cloudy" }
    });
    expect(view.calendar.data.map((event) => event.title)).toEqual(["Стендап команды"]);
    expect(view.calendar.data[0]?.calendar.name).toBe("Работа");
    expect(view.routines.data.map((item) => item.title)).toEqual([
      "Выпить 1 литр воды",
      "Погладить кота",
      "Сделать зарядку"
    ]);
    expect(view.news.data.map((item) => item.topic)).toEqual(["Агенты", "Бизнес"]);
    expect(view.timer.data).toMatchObject({
      phase: "work",
      runStatus: "idle",
      completedWorkToday: 0,
      dailyGoal: 8
    });
  });

  it("показывает отключённый источник и прячет скрытые дела", () => {
    const disconnected: Dashboard = {
      ...dashboard,
      weather: { status: "unavailable" },
      calendar: { status: "empty" },
      routines: {
        status: "ready",
        day: {
          date: "2026-11-24",
          progress: { done: 0, total: 0 },
          items: [
            {
              id: "64b7f0c2a1d4e8f01a2b3c58",
              ruleId: "64b7f0c2a1d4e8f01a2b3c59",
              localDate: "2026-11-24",
              title: "Скрытое дело",
              status: "hidden",
              completedAt: null
            }
          ]
        }
      }
    };

    const view = presentDashboard(disconnected, "Europe/Moscow");

    expect(view.weather).toMatchObject({ status: "disconnected", data: null });
    expect(view.calendar.status).toBe("empty");
    expect(view.routines).toMatchObject({ status: "empty", data: [] });
  });

  it("не роняет доску, если у готовых рутин нет дня", () => {
    const broken = {
      ...dashboard,
      routines: { status: "ready", day: null }
    } as unknown as Dashboard;

    expect(presentDashboard(broken, "Europe/Moscow").routines).toMatchObject({
      status: "error",
      data: []
    });
  });
});
