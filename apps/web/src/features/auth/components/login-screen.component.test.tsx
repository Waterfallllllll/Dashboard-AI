import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LoginScreen } from "./login-screen";

describe("LoginScreen", () => {
  it("ведёт на вход через Google", () => {
    render(<LoginScreen />);

    expect(screen.getByRole("link", { name: /Продолжить с Google/ })).toHaveAttribute(
      "href",
      "/api/v1/auth/google"
    );
    expect(
      screen.getByText("Google запросит только имя, адрес почты и профиль.")
    ).toBeInTheDocument();
    expect(screen.getByText(/Мы не храним OAuth-токены в браузере/)).toBeInTheDocument();
  });

  it("сообщает об ошибке входа", () => {
    render(<LoginScreen status="error" />);

    expect(
      screen.getByText("Не удалось завершить вход через Google. Повторите попытку позже.")
    ).toBeInTheDocument();
  });

  it("ведёт к юридическим документам", () => {
    render(<LoginScreen />);

    expect(screen.getByRole("link", { name: "условия использования" })).toHaveAttribute(
      "href",
      "/terms"
    );
    expect(screen.getByRole("link", { name: "политикой конфиденциальности" })).toHaveAttribute(
      "href",
      "/privacy"
    );
  });
});
