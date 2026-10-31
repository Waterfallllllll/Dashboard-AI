import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithUser } from "@/test/render";

import { createIdleTimer, startTimer, WORK_DURATION_MS } from "../model/timer-state";

import { TimerWidget } from "./timer-widget";

describe("TimerWidget", () => {
  it("запускает интервал по абсолютному endsAt", async () => {
    const now = 1_000_000;
    const { user } = renderWithUser(<TimerWidget now={now} persist={false} />);

    expect(screen.getByText("Работа")).toBeInTheDocument();
    expect(screen.getByText("25:00")).toBeInTheDocument();
    expect(screen.getByText("Фокус сегодня: 2 / 8")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Старт" }));
    expect(screen.getByRole("button", { name: "Пауза" })).toBeInTheDocument();
  });

  it("показывает оставшееся время активной сессии", () => {
    const now = 10_000;
    const session = startTimer(createIdleTimer(), 0);

    renderWithUser(
      <TimerWidget initialSession={session} now={now} persist={false} />
    );

    const remaining = WORK_DURATION_MS - now;
    const minutes = String(Math.floor(remaining / 60_000)).padStart(2, "0");
    const seconds = String(Math.floor((remaining % 60_000) / 1000)).padStart(2, "0");
    expect(screen.getByText(`${minutes}:${seconds}`)).toBeInTheDocument();
    expect(screen.getByText("Далее: короткий отдых 5 мин")).toBeInTheDocument();
  });
});
