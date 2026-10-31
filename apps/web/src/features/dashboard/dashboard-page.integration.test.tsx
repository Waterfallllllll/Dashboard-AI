import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageScaffold } from "@/components/ui/page-scaffold";
import { renderWithUser } from "@/test/render";

import { DashboardBoard } from "./components/dashboard-board";
import { DEFAULT_WIDGET_LAYOUT } from "./model/widget-catalog";

describe("страница дашборда", () => {
  it("показывает содержимое виджетов в одной сетке", () => {
    renderWithUser(
      <PageScaffold
        contentVariant="plain"
        description="Сетка виджетов"
        eyebrow="Сегодня"
        title="Ваш день в одном месте"
      >
        <DashboardBoard />
      </PageScaffold>
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Ваш день в одном месте" })
    ).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Дата и время" })).toHaveAttribute(
      "data-status",
      "success"
    );
    expect(screen.getByText("Москва")).toBeInTheDocument();
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
  });

  it("повторяет загрузку одного виджета, не меняя остальные", async () => {
    const { user } = renderWithUser(
      <DashboardBoard
        states={{
          datetime: "success",
          weather: "success",
          calendar: "success",
          routines: "success",
          timer: "error",
          news: "success"
        }}
      />
    );

    await user.click(screen.getByRole("button", { name: "Повторить" }));

    expect(screen.getByRole("article", { name: "Таймер" })).toHaveAttribute(
      "data-status",
      "success"
    );
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
