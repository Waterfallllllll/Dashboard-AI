import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { THEME_STORAGE_KEY } from "@/lib/theme/theme-preference";
import { renderWithUser } from "@/test/render";

import { ThemeControl } from "./theme-control";

describe("ThemeControl", () => {
  it("применяет сохранённую тему при монтировании", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");

    renderWithUser(<ThemeControl />);

    expect(screen.getByLabelText("Тема интерфейса")).toHaveValue("dark");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });

  it("сохраняет выбранную тему в localStorage", async () => {
    const { user } = renderWithUser(<ThemeControl />);

    await user.selectOptions(screen.getByLabelText("Тема интерфейса"), "light");

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
  });
});
