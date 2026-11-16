import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { renderWithUser } from "@/test/render";

import { DashboardBoard } from "./components/dashboard-board";
import { resetWidgetPreferencesStoreForTests } from "./model/widget-preferences-store";

describe("редактор виджетов на дашборде", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetWidgetPreferencesStoreForTests();
  });

  it("сразу применяет видимость, температуру и источники к сетке", async () => {
    const { user } = renderWithUser(<DashboardBoard />);

    await user.click(screen.getByRole("button", { name: "Быстрая настройка" }));
    await user.click(screen.getByRole("switch", { name: "Показывать «Погода»" }));

    expect(screen.queryByRole("article", { name: "Погода" })).not.toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Дата и время" })).toBeInTheDocument();

    await user.click(screen.getByRole("switch", { name: "Показывать «Погода»" }));
    await user.click(screen.getByRole("radio", { name: "Фаренгейт" }));
    expect(screen.getByText("+52°")).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Только официальные" }));
    expect(
      screen.queryByRole("link", { name: /Meta AI прокомментировала правила прозрачности/ })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: /OpenAI расширила инструменты для агентных рабочих процессов/
      })
    ).toBeInTheDocument();
  }, 15_000);
});
