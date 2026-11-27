import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithUser } from "@/test/render";

import type { AccountView } from "../api/account-session";
import { PROFILE_PREFERENCES_STORAGE_KEY } from "../model/profile-preferences";

import { ProfileSettings } from "./profile-settings";

const signedInAccount: AccountView = {
  status: "authenticated",
  displayName: "Илья",
  avatarUrl: "https://lh3.googleusercontent.com/a/a",
  csrfToken: "a".repeat(43)
};

const anonymousAccount: AccountView = { status: "anonymous" };

describe("ProfileSettings", () => {
  it("сохраняет часовой пояс и формат времени локально", async () => {
    const { user } = renderWithUser(<ProfileSettings loadSession={async () => anonymousAccount} />);

    await screen.findByText("Не авторизован");
    await user.selectOptions(screen.getByLabelText("Часовой пояс"), "Europe/Moscow");
    await user.click(screen.getByRole("radio", { name: "12 часов" }));
    await user.click(screen.getByRole("button", { name: "Сохранить предпочтения" }));

    expect(screen.getByText("Предпочтения сохранены в этом браузере.")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(PROFILE_PREFERENCES_STORAGE_KEY) ?? "")).toEqual({
      timezone: "Europe/Moscow",
      timeFormat: "12"
    });
  });

  it("показывает гостя и не даёт выйти без сессии", async () => {
    renderWithUser(<ProfileSettings loadSession={async () => anonymousAccount} />);

    expect(await screen.findByText("Не авторизован")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Войти через Google" })).toHaveAttribute(
      "href",
      "/api/v1/auth/google"
    );
    expect(screen.getByRole("button", { name: "Выйти" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Удалить аккаунт" })).toBeDisabled();
  });

  it("показывает имя и аватар текущей сессии", async () => {
    const view = renderWithUser(<ProfileSettings loadSession={async () => signedInAccount} />);

    expect(await screen.findByRole("heading", { name: "Илья" })).toBeInTheDocument();
    expect(screen.getByText("Авторизован")).toBeInTheDocument();
    expect(view.container.querySelector("img")).toHaveAttribute("src", signedInAccount.avatarUrl);
    expect(screen.getByRole("button", { name: "Выйти" })).toBeEnabled();
  });

  it("завершает вход и уходит на страницу логина", async () => {
    const signOut = vi.fn<(csrfToken: string) => Promise<void>>().mockResolvedValue(undefined);
    const onSignedOut = vi.fn();
    const { user } = renderWithUser(
      <ProfileSettings
        loadSession={async () => signedInAccount}
        onSignedOut={onSignedOut}
        signOut={signOut}
      />
    );

    await screen.findByRole("heading", { name: "Илья" });
    await user.click(screen.getByRole("button", { name: "Выйти" }));

    await waitFor(() => {
      expect(signOut).toHaveBeenCalledWith(signedInAccount.csrfToken);
    });
    expect(onSignedOut).toHaveBeenCalledOnce();
    expect(await screen.findByText("Не авторизован")).toBeInTheDocument();
  });

  it("оставляет сессию, если выход не удался", async () => {
    const signOut = vi
      .fn<(csrfToken: string) => Promise<void>>()
      .mockRejectedValue(new Error("нет сети"));
    const onSignedOut = vi.fn();
    const { user } = renderWithUser(
      <ProfileSettings
        loadSession={async () => signedInAccount}
        onSignedOut={onSignedOut}
        signOut={signOut}
      />
    );

    await screen.findByRole("heading", { name: "Илья" });
    await user.click(screen.getByRole("button", { name: "Выйти" }));

    expect(await screen.findByText("Не удалось выйти. Повторите попытку.")).toBeInTheDocument();
    expect(screen.getByText("Авторизован")).toBeInTheDocument();
    expect(onSignedOut).not.toHaveBeenCalled();
  });

  it("просит подтверждение и удаляет аккаунт", async () => {
    const removeAccount = vi
      .fn<(csrfToken: string) => Promise<void>>()
      .mockResolvedValue(undefined);
    const onAccountDeleted = vi.fn();
    const { user } = renderWithUser(
      <ProfileSettings
        loadSession={async () => signedInAccount}
        onAccountDeleted={onAccountDeleted}
        removeAccount={removeAccount}
      />
    );

    await screen.findByRole("heading", { name: "Илья" });
    expect(screen.getByRole("button", { name: "Удалить аккаунт" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Удалить аккаунт" }));

    const dialog = await screen.findByRole("dialog", { name: "Удалить аккаунт?" });
    await user.click(within(dialog).getByRole("button", { name: "Отмена" }));
    expect(removeAccount).not.toHaveBeenCalled();
    expect(dialog).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Удалить аккаунт" }));
    const confirmation = await screen.findByRole("dialog", { name: "Удалить аккаунт?" });
    await user.click(within(confirmation).getByRole("button", { name: "Удалить аккаунт" }));

    await waitFor(() => {
      expect(removeAccount).toHaveBeenCalledWith(signedInAccount.csrfToken);
    });
    expect(onAccountDeleted).toHaveBeenCalledOnce();
  });

  it("оставляет аккаунт, если удаление не удалось", async () => {
    const removeAccount = vi
      .fn<(csrfToken: string) => Promise<void>>()
      .mockRejectedValue(new Error("нет сети"));
    const onAccountDeleted = vi.fn();
    const { user } = renderWithUser(
      <ProfileSettings
        loadSession={async () => signedInAccount}
        onAccountDeleted={onAccountDeleted}
        removeAccount={removeAccount}
      />
    );

    await screen.findByRole("heading", { name: "Илья" });
    await user.click(screen.getByRole("button", { name: "Удалить аккаунт" }));
    const dialog = await screen.findByRole("dialog", { name: "Удалить аккаунт?" });
    await user.click(within(dialog).getByRole("button", { name: "Удалить аккаунт" }));

    expect(
      await screen.findByText("Не удалось удалить аккаунт. Повторите попытку.")
    ).toBeInTheDocument();
    expect(screen.getByText("Авторизован")).toBeInTheDocument();
    expect(onAccountDeleted).not.toHaveBeenCalled();
  });
});
