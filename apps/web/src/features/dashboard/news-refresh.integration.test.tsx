import { dashboardSchema } from "@dashboard/contracts";
import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithUser } from "@/test/render";

import { DashboardBoard } from "./components/dashboard-board";
import { sampleDashboardBody } from "./model/sample-dashboard";

const readyDashboard = dashboardSchema.parse(sampleDashboardBody);

describe("пустые новости", () => {
  it("говорит, что за сутки материалов нет, и не ведёт в настройки виджетов", async () => {
    renderWithUser(
      <DashboardBoard
        loadDay={async () => ({
          status: "ready",
          dashboard: { ...readyDashboard, news: { status: "empty", updatedAt: null } }
        })}
      />
    );

    const news = await screen.findByRole("article", { name: "Новости" });

    expect(
      within(news).getByRole("heading", { name: "За последние сутки новостей нет" })
    ).toBeInTheDocument();
    expect(within(news).queryByRole("link", { name: "Настроить виджеты" })).not.toBeInTheDocument();
  });

  it("дожидается ленты, если дашборд ещё её читает", async () => {
    renderWithUser(
      <DashboardBoard
        loadDay={async () => ({
          status: "ready",
          dashboard: { ...readyDashboard, news: { status: "pending" } }
        })}
        loadNews={async () => readyDashboard.news}
      />
    );

    expect(screen.getByRole("article", { name: "Новости" })).toHaveAttribute("data-status", "loading");
    expect(
      await screen.findByRole("link", {
        name: /OpenAI расширила инструменты для агентных рабочих процессов/
      })
    ).toBeInTheDocument();
  });

  it("по кнопке обновления ещё раз запрашивает ленты", async () => {
    const loadNews = vi.fn(async () => readyDashboard.news);
    const { user } = renderWithUser(
      <DashboardBoard
        loadDay={async () => ({
          status: "ready",
          dashboard: { ...readyDashboard, news: { status: "empty", updatedAt: null } }
        })}
        loadNews={loadNews}
      />
    );

    await screen.findByRole("heading", { name: "За последние сутки новостей нет" });
    await user.click(screen.getByRole("button", { name: "Обновить виджет «Новости»" }));

    await waitFor(() => {
      expect(loadNews).toHaveBeenCalledWith({ refresh: true });
    });
    expect(
      await screen.findByRole("link", {
        name: /OpenAI расширила инструменты для агентных рабочих процессов/
      })
    ).toBeInTheDocument();
  });
});
