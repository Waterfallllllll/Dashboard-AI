import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageScaffold } from "@/components/ui/page-scaffold";
import { THEME_STORAGE_KEY } from "@/lib/theme/theme-preference";
import { renderWithUser } from "@/test/render";

import { ProfileSettings } from "./components/profile-settings";
import { PROFILE_PREFERENCES_STORAGE_KEY } from "./model/profile-preferences";

describe("страница профиля", () => {
  it("сохраняет предпочтения профиля и тему на одной странице", async () => {
    const { user } = renderWithUser(
      <PageScaffold
        contentVariant="plain"
        description="Настройте внешний вид, часовой пояс и параметры аккаунта."
        eyebrow="Настройки"
        title="Профиль"
      >
        <ProfileSettings />
      </PageScaffold>
    );

    expect(screen.getByRole("heading", { level: 1, name: "Профиль" })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Часовой пояс"), "Asia/Vladivostok");
    await user.selectOptions(screen.getByLabelText("Тема интерфейса"), "dark");
    await user.click(screen.getByRole("button", { name: "Сохранить предпочтения" }));

    expect(screen.getByText("Предпочтения сохранены в этом браузере.")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(PROFILE_PREFERENCES_STORAGE_KEY) ?? "")).toEqual({
      timezone: "Asia/Vladivostok",
      timeFormat: "24"
    });
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });
});
