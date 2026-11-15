import type { Session } from "@dashboard/contracts";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiSessionProvider } from "@/features/session";
import { renderWithUser } from "@/test/render";

import { IntegrationList } from "./integration-list";

const TELEGRAM_URL = "https://t.me/evergreen_bot?start=abcdefghijklmnopqrstuvwxyz012345";

const session = {
  user: {
    id: "11111111-1111-4111-8111-111111111111",
    displayName: "Илья",
    avatarUrl: null,
    locale: "ru",
    timezone: "Europe/Moscow",
    timeFormat: "24",
    theme: "system",
    createdAt: "2026-11-16T00:00:00.000Z",
    updatedAt: "2026-11-16T00:00:00.000Z"
  },
  expiresAt: "2026-11-30T00:00:00.000Z",
  csrfToken: "a".repeat(43)
} satisfies Session;

describe("IntegrationList с сессией", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("показывает статус API и оставляет ссылку Telegram на странице", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";

        if (url.includes("/api/v1/integrations/telegram/link") && method === "POST") {
          return Response.json({
            data: {
              url: TELEGRAM_URL,
              expiresAt: "2026-11-16T23:00:00.000Z"
            },
            meta: { requestId: "request-telegram" }
          });
        }

        if (new URL(url).pathname === "/api/v1/integrations") {
          return Response.json({
            data: {
              integrations: [
                {
                  type: "google_calendar",
                  status: "connected",
                  lastSyncAt: "2026-11-16T08:30:00.000Z"
                },
                { type: "telegram", status: "revoked", lastSyncAt: null }
              ]
            },
            meta: { requestId: "request-list" }
          });
        }

        return new Response(null, { status: 404 });
      })
    );

    const { user } = renderWithUser(
      <ApiSessionProvider session={session}>
        <IntegrationList calendarReturn="connected" />
      </ApiSessionProvider>
    );
    const pageUrl = window.location.href;

    expect(await screen.findByText("Календарь подключён. События появятся на дашборде после синхронизации.")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Подключить Telegram" })).toBeEnabled();
    });
    expect(screen.getByRole("button", { name: "Отключить календарь" })).toBeEnabled();
    expect(screen.getByText("Доступ отозван")).toBeInTheDocument();
    expect(screen.getByText(/Последняя синхронизация/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Подключить Telegram" }));

    const link = await screen.findByRole("link", { name: "Открыть бота в Telegram" });
    expect(link).toHaveAttribute("href", TELEGRAM_URL);
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByRole("status")).not.toHaveTextContent("abcdefghijklmnopqrstuvwxyz");
    expect(window.location.href).toBe(pageUrl);
  });
});

describe("IntegrationList без сессии", () => {
  it("не читает query возврата как подтверждение", () => {
    render(<IntegrationList calendarReturn="connected" />);

    expect(
      screen.queryByText("Календарь подключён. События появятся на дашборде после синхронизации.")
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Подключить календарь" })).toBeDisabled();
  });
});
