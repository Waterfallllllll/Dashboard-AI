import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithUser } from "@/test/render";

import { PROFILE_PREFERENCES_STORAGE_KEY } from "../model/profile-preferences";

import { ProfileSettings } from "./profile-settings";

describe("ProfileSettings", () => {
  it("сохраняет часовой пояс и формат времени локально", async () => {
    const { user } = renderWithUser(<ProfileSettings />);

    await user.selectOptions(screen.getByLabelText("Часовой пояс"), "Europe/Moscow");
    await user.click(screen.getByRole("radio", { name: "12 часов" }));
    await user.click(screen.getByRole("button", { name: "Сохранить предпочтения" }));

    expect(screen.getByText("Предпочтения сохранены в этом браузере.")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(PROFILE_PREFERENCES_STORAGE_KEY) ?? "")).toEqual({
      timezone: "Europe/Moscow",
      timeFormat: "12"
    });
  });

  it("не даёт выйти и удалить аккаунт до backend-сессии", () => {
    renderWithUser(<ProfileSettings />);

    expect(screen.getByRole("button", { name: "Выйти" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Удалить аккаунт" })).toBeDisabled();
    expect(screen.getByText("Не авторизован")).toBeInTheDocument();
  });
});
