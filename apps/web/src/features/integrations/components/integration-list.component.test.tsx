import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { IntegrationList } from "./integration-list";

describe("IntegrationList", () => {
  it("показывает интеграции MVP и блокирует подключение до API", () => {
    render(<IntegrationList />);

    expect(screen.getByRole("heading", { name: "Google Calendar" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Telegram" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Местоположение" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Уведомления браузера" })).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Подключить календарь" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Подключить Telegram" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Настроить локацию" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Включить уведомления" })).toBeDisabled();
  });
});
