import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { navigationState } from "@/test/navigation-state";

import { AppShell } from "./app-shell";

describe("AppShell", () => {
  it("собирает skip-link, ориентиры и навигацию рабочего пространства", () => {
    navigationState.pathname = "/dashboard";

    render(
      <AppShell>
        <h1>Рабочая область</h1>
      </AppShell>
    );

    expect(screen.getByRole("link", { name: "Перейти к содержимому" })).toHaveAttribute(
      "href",
      "#main-content"
    );
    expect(screen.getByRole("navigation", { name: "Основная навигация" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Мобильная навигация" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Открыть профиль" })).toHaveAttribute(
      "href",
      "/settings/profile"
    );
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    expect(screen.getByRole("heading", { name: "Рабочая область" })).toBeInTheDocument();

    const homeLinks = screen.getAllByRole("link", { name: "Главная" });

    expect(homeLinks.length).toBeGreaterThan(0);
    expect(homeLinks[0]).toHaveAttribute("aria-current", "page");
  });
});
