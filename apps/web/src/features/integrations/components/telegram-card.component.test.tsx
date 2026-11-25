import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TelegramLinkError } from "../api/connect-telegram";

import { TelegramCard } from "./telegram-card";

const botUrl = `https://t.me/DashBot?start=${"a".repeat(43)}`;

describe("TelegramCard", () => {
  it("после нажатия открывает ссылку бота", async () => {
    const createLink = vi.fn().mockResolvedValue({
      url: botUrl,
      expiresAt: "2026-11-25T12:10:00.000Z"
    });
    const openLink = vi.fn();
    const user = userEvent.setup();

    render(
      <TelegramCard
        createLink={createLink}
        openLink={openLink}
        readStatus={vi.fn().mockResolvedValue("disconnected")}
      />
    );
    await user.click(screen.getByRole("button", { name: "Подключить Telegram" }));

    expect(createLink).toHaveBeenCalledOnce();
    expect(openLink).toHaveBeenCalledWith(botUrl);
    expect(screen.getByRole("link", { name: "Открыть бота" })).toHaveAttribute("href", botUrl);
    expect(screen.getByRole("link", { name: "Открыть бота" })).toHaveAttribute("target", "_blank");
  });

  it("предлагает вход, если сессии нет", async () => {
    const user = userEvent.setup();

    render(
      <TelegramCard
        createLink={vi.fn().mockRejectedValue(new TelegramLinkError("unauthenticated"))}
        readStatus={vi.fn().mockResolvedValue(null)}
      />
    );
    await user.click(screen.getByRole("button", { name: "Подключить Telegram" }));

    expect(screen.getByRole("link", { name: "Войти через Google" })).toHaveAttribute(
      "href",
      "/api/v1/auth/google"
    );
  });

  it("показывает отключение, если бот уже привязан", () => {
    render(<TelegramCard readStatus={vi.fn()} status="connected" />);

    expect(screen.queryByRole("button", { name: "Подключить Telegram" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Отключить Telegram" })).toBeEnabled();
    expect(screen.getByText("Бот привязан. Уведомления уходят в этот чат.")).toBeInTheDocument();
  });
});
