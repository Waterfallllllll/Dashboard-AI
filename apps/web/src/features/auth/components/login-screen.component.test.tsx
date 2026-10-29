import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LoginScreen } from "./login-screen";

describe("LoginScreen", () => {
  it("не включает Google OAuth до появления backend-потока", () => {
    render(<LoginScreen />);

    expect(screen.getByRole("button", { name: /Продолжить с Google/ })).toBeDisabled();
    expect(
      screen.getByText("Вход станет доступен после подключения защищённого OAuth-потока.")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Мы не храним OAuth-токены в браузере/)
    ).toBeInTheDocument();
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
