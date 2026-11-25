import { dashboardSchema } from "@dashboard/contracts";
import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CalendarSyncError } from "@/features/calendar";
import { renderWithUser } from "@/test/render";

import { DashboardBoard } from "./components/dashboard-board";
import { sampleDashboardBody } from "./model/sample-dashboard";

const readyDashboard = dashboardSchema.parse(sampleDashboardBody);
const emptyCalendarDashboard = { ...readyDashboard, calendar: { status: "empty" as const } };

describe("обновление календаря", () => {
  it("показывает пустой день без перехода в настройки виджетов", async () => {
    renderWithUser(<DashboardBoard loadDay={async () => ({ status: "ready", dashboard: emptyCalendarDashboard })} />);

    const calendar = await screen.findByRole("article", { name: "Календарь" });

    expect(
      within(calendar).getByRole("heading", { name: "На сегодня событий нет" })
    ).toBeInTheDocument();
    expect(
      within(calendar).queryByRole("link", { name: "Настроить виджеты" })
    ).not.toBeInTheDocument();
  });

  it("запрашивает Google и показывает полученные события", async () => {
    const syncCalendarDay = vi.fn(async () => readyDashboard.calendar);
    const { user } = renderWithUser(
      <DashboardBoard
        loadDay={async () => ({ status: "ready", dashboard: emptyCalendarDashboard })}
        syncCalendarDay={syncCalendarDay}
      />
    );

    expect(await screen.findByRole("heading", { name: "На сегодня событий нет" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Обновить виджет «Календарь»" }));

    expect(await screen.findByText("Стендап команды")).toBeInTheDocument();
    expect(syncCalendarDay).toHaveBeenCalledTimes(1);
    expect(syncCalendarDay.mock.calls[0]?.[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("после отказа подключения предлагает подключить календарь", async () => {
    const { user } = renderWithUser(
      <DashboardBoard
        loadDay={async () => ({ status: "ready", dashboard: emptyCalendarDashboard })}
        syncCalendarDay={async () => {
          throw new CalendarSyncError("missing");
        }}
      />
    );

    await screen.findByRole("heading", { name: "На сегодня событий нет" });
    await user.click(screen.getByRole("button", { name: "Обновить виджет «Календарь»" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Календарь не подключён" })).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: "Подключить" })).toHaveAttribute(
      "href",
      "/settings/integrations"
    );
  });
});
