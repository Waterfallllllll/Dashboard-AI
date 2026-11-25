import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { IntegrationList } from "./integration-list";

describe("IntegrationList", () => {
  it("показывает интеграции MVP и включает подключение календаря", () => {
    render(<IntegrationList />);

    expect(screen.getByRole("heading", { name: "Google Calendar" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Telegram" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Местоположение" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Уведомления браузера" })).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Подключить календарь" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Подключить Telegram" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Включить уведомления" })).toBeDisabled();

    const location = screen.getByRole("heading", { name: "Местоположение" }).closest("li");

    expect(location).not.toBeNull();

    if (location) {
      expect(within(location).getByRole("button", { name: "Определить место" })).toBeEnabled();
      expect(within(location).getByRole("button", { name: "Сохранить город" })).toBeEnabled();
      expect(within(location).queryByText("Доступно после подключения API")).not.toBeInTheDocument();
    }
  });
});
