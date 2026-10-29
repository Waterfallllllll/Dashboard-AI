import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { navigationState } from "@/test/navigation-state";

import { AppNavigation } from "./app-navigation";

describe("AppNavigation", () => {
  it("помечает текущий пункт боковой навигации", () => {
    navigationState.pathname = "/settings/profile";

    render(<AppNavigation variant="sidebar" />);

    expect(screen.getByRole("link", { name: "Профиль" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Главная" })).not.toHaveAttribute("aria-current");
  });

  it("в нижней навигации не считает рутины настройками", () => {
    navigationState.pathname = "/settings/routines";

    render(<AppNavigation variant="bottom" />);

    expect(screen.getByRole("link", { name: "Рутины" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Настройки" })).not.toHaveAttribute("aria-current");
  });
});
