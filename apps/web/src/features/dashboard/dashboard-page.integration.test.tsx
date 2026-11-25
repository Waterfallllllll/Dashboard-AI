import { dashboardSchema, type Dashboard } from "@dashboard/contracts";
import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageScaffold } from "@/components/ui/page-scaffold";
import { renderWithUser } from "@/test/render";

import { DashboardBoard } from "./components/dashboard-board";
import { DEFAULT_WIDGET_LAYOUT } from "./model/widget-catalog";
import { sampleDashboardBody } from "./model/sample-dashboard";

const readyDashboard = dashboardSchema.parse(sampleDashboardBody);

function loadReady(dashboard: Dashboard = readyDashboard) {
  return async () => ({ status: "ready" as const, dashboard });
}

describe("страница дашборда", () => {
  it("показывает содержимое виджетов в одной сетке", async () => {
    renderWithUser(
      <PageScaffold
        contentVariant="plain"
        description="Сетка виджетов"
        eyebrow="Сегодня"
        title="Ваш день в одном месте"
      >
        <DashboardBoard loadDay={loadReady()} />
      </PageScaffold>
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Ваш день в одном месте" })
    ).toBeInTheDocument();
    expect(await screen.findByText("Москва")).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Дата и время" })).toHaveAttribute(
      "data-status",
      "success"
    );
    expect(screen.getByText("Стендап команды")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Погладить кота" })).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Таймер" })).toHaveTextContent("Работа");
    expect(
      screen.getByRole("link", {
        name: /OpenAI расширила инструменты для агентных рабочих процессов/
      })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Настроить виджеты" })).toHaveAttribute(
      "href",
      "/settings/widgets"
    );
    expect(screen.queryByText("Мок-данные")).not.toBeInTheDocument();
  });

  it("повторяет загрузку одного виджета, не меняя остальные", async () => {
    let calls = 0;
    const { user } = renderWithUser(
      <DashboardBoard
        loadDay={async () => {
          calls += 1;
          return {
            status: "ready",
            dashboard:
              calls === 1
                ? {
                    ...readyDashboard,
                    timer: { status: "error", message: "Не удалось загрузить раздел." }
                  }
                : readyDashboard
          };
        }}
      />
    );

    expect(await screen.findByText("Москва")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Повторить" }));

    await waitFor(() => {
      expect(screen.getByRole("article", { name: "Таймер" })).toHaveAttribute(
        "data-status",
        "success"
      );
    });
    expect(screen.getByRole("article", { name: "Погода" })).toHaveAttribute(
      "data-status",
      "success"
    );
    expect(screen.getByText("Москва")).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Таймер" })).toHaveTextContent("Работа");
  });

  it("показывает пустое состояние, если все виджеты выключены", () => {
    renderWithUser(
      <DashboardBoard
        loadDay={loadReady()}
        layout={DEFAULT_WIDGET_LAYOUT.map((widget) => ({
          ...widget,
          enabled: false
        }))}
      />
    );

    expect(screen.getByRole("heading", { name: "Нет виджетов на экране" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Добавить виджеты" })).toHaveAttribute(
      "href",
      "/settings/widgets"
    );
    expect(screen.queryByRole("article", { name: "Погода" })).not.toBeInTheDocument();
  });
});
