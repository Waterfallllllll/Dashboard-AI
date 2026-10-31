import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithUser } from "@/test/render";

import { DEFAULT_WIDGET_LAYOUT, type WidgetPlacement } from "../model/widget-layout";

import { WidgetCard } from "./widget-card";

function placement(type: WidgetPlacement["type"]): WidgetPlacement {
  const widget = DEFAULT_WIDGET_LAYOUT.find((item) => item.type === type);

  if (!widget) {
    throw new Error(`Нет виджета ${type}`);
  }

  return widget;
}

describe("WidgetCard", () => {
  it("показывает skeleton загрузки без скачка на ошибку", () => {
    renderWithUser(
      <WidgetCard status="loading" widget={placement("weather")}>
        <p>Не должно быть видно</p>
      </WidgetCard>
    );

    expect(screen.getByRole("article", { name: "Погода" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Загружаем «Погода»")).toBeInTheDocument();
    expect(screen.queryByText("Не должно быть видно")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Повторить" })).not.toBeInTheDocument();
  });

  it("оставляет ошибку внутри карточки и даёт повторить", async () => {
    let retried = false;
    const { user } = renderWithUser(
      <WidgetCard
        onRetry={() => {
          retried = true;
        }}
        status="error"
        widget={placement("timer")}
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Не удалось обновить данные");
    await user.click(screen.getByRole("button", { name: "Повторить" }));
    expect(retried).toBe(true);
  });

  it("показывает пустое состояние и действие", () => {
    renderWithUser(<WidgetCard status="empty" widget={placement("routines")} />);

    expect(screen.getByRole("heading", { name: "На сегодня нет рутин" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Открыть рутины" })).toHaveAttribute(
      "href",
      "/settings/routines"
    );
  });

  it("оставляет устаревшие данные на экране с предупреждением", () => {
    renderWithUser(
      <WidgetCard status="stale" updatedAtLabel="сегодня в 09:12" widget={placement("news")}>
        <p>Последний сохранённый обзор</p>
      </WidgetCard>
    );

    expect(screen.getByText("Последний сохранённый обзор")).toBeInTheDocument();
    expect(screen.getAllByText("Данные могут быть устаревшими").length).toBeGreaterThan(0);
    expect(screen.getByText("Обновлено сегодня в 09:12")).toBeInTheDocument();
  });

  it("для permission и disconnected предлагает настройки интеграций", () => {
    const { rerender } = renderWithUser(
      <WidgetCard status="permission-required" widget={placement("weather")} />
    );

    expect(screen.getByRole("link", { name: "Открыть настройки" })).toHaveAttribute(
      "href",
      "/settings/integrations"
    );

    rerender(<WidgetCard status="disconnected" widget={placement("calendar")} />);
    expect(screen.getByRole("link", { name: "Подключить" })).toHaveAttribute(
      "href",
      "/settings/integrations"
    );
  });

  it("открывает меню действий виджета", async () => {
    const { user } = renderWithUser(
      <WidgetCard status="success" widget={placement("datetime")}>
        <p>Каркас</p>
      </WidgetCard>
    );

    await user.click(screen.getByRole("button", { name: "Действия виджета «Дата и время»" }));
    expect(screen.getByRole("menuitem", { name: "Настроить виджеты" })).toHaveAttribute(
      "href",
      "/settings/widgets"
    );
    expect(screen.queryByRole("menuitem", { name: "Обновить" })).not.toBeInTheDocument();
  });
});
