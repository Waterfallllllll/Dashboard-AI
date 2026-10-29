import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LoginScreen } from "@/features/auth";

import { PublicShell } from "./public-shell";

describe("PublicShell", () => {
  it("связывает публичную оболочку со страницей входа и юридическими ссылками", () => {
    render(
      <PublicShell>
        <LoginScreen status="cancelled" />
      </PublicShell>
    );

    expect(screen.getByRole("link", { name: "Evergreen Dashboard" })).toHaveAttribute(
      "href",
      "/login"
    );
    expect(screen.getByRole("navigation", { name: "Юридическая информация" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Конфиденциальность" })).toHaveAttribute(
      "href",
      "/privacy"
    );
    expect(screen.getByRole("link", { name: "Условия" })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("heading", { name: /Важное — перед глазами/ })).toBeInTheDocument();
    expect(screen.getByText("Вход отменён. Можно попробовать ещё раз, когда будете готовы.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Продолжить с Google/ })).toBeDisabled();
  });
});
