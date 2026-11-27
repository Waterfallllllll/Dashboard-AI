import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { publishProductNotice } from "../model/notification-center";
import {
  APP_NOTICE_VISIBLE_MS,
  resetNotificationStoreForTests
} from "../model/notification-preferences-store";

import { NotificationHost } from "./notification-host";

describe("панель уведомления", () => {
  afterEach(() => {
    resetNotificationStoreForTests();
    vi.useRealTimers();
  });

  it("сама скрывается через несколько секунд", async () => {
    vi.useFakeTimers();
    render(<NotificationHost />);
    act(() => {
      publishBreakNotice("timer:short-break:1");
    });

    expect(screen.getByText("Перерыв завершён")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(APP_NOTICE_VISIBLE_MS);
    });

    expect(screen.queryByText("Перерыв завершён")).not.toBeInTheDocument();
  });

  it("держит новое сообщение полный срок, если интервал сменился раньше", async () => {
    vi.useFakeTimers();
    render(<NotificationHost />);
    act(() => {
      publishBreakNotice("timer:short-break:1");
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(APP_NOTICE_VISIBLE_MS - 1_000);
    });
    act(() => {
      publishBreakNotice("timer:work:2", "Рабочий интервал завершён");
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(screen.getByText("Рабочий интервал завершён")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(APP_NOTICE_VISIBLE_MS - 1_000);
    });
    expect(screen.queryByText("Рабочий интервал завершён")).not.toBeInTheDocument();
  });
});

function publishBreakNotice(key: string, title = "Перерыв завершён"): void {
  publishProductNotice({
    key,
    title,
    body: "Можно начать следующий рабочий интервал.",
    kind: title.startsWith("Рабочий") ? "work" : "break",
    now: new Date(2026, 10, 27, 8, 42)
  });
}
