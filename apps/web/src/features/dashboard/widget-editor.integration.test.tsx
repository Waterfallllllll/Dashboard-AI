import { dashboardSchema } from "@dashboard/contracts";
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { renderWithUser } from "@/test/render";

import { DashboardBoard } from "./components/dashboard-board";
import { sampleDashboardBody } from "./model/sample-dashboard";
import { resetWidgetPreferencesStoreForTests } from "./model/widget-preferences-store";

const readyDashboard = dashboardSchema.parse(sampleDashboardBody);

describe("редактор виджетов на дашборде", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetWidgetPreferencesStoreForTests();
  });

  it("сразу применяет видимость, температуру и источники к сетке", async () => {
    const { user } = renderWithUser(
      <DashboardBoard loadDay={async () => ({ status: "ready", dashboard: readyDashboard })} />
    );

    await user.click(screen.getByRole("button", { name: "Быстрая настройка" }));
    await user.click(screen.getByRole("switch", { name: "Показывать «Погода»" }));

    expect(screen.queryByRole("article", { name: "Погода" })).not.toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Дата и время" })).toBeInTheDocument();

    await user.click(screen.getByRole("switch", { name: "Показывать «Погода»" }));
    await user.click(screen.getByRole("radio", { name: "Фаренгейт" }));
    expect(await screen.findByText("+52°")).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Только официальные" }));
    expect(
      screen.queryByRole("link", { name: /Meta AI прокомментировала правила прозрачности/ })
    ).not.toBeInTheDocument();
    expect(
      await screen.findByRole("link", {
        name: /OpenAI расширила инструменты для агентных рабочих процессов/
      })
    ).toBeInTheDocument();
  }, 15_000);
});
