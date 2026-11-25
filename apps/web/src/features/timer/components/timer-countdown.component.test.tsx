import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TimerWidget } from "./timer-widget";

describe("отсчёт таймера", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("уменьшает работу и короткий отдых по живым часам", async () => {
    vi.useFakeTimers();
    render(<TimerWidget configurable persist={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Старт" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(screen.getByText("24:59")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Пропустить интервал" }));
    expect(screen.getByText("05:00")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Старт" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(screen.getByText("04:59")).toBeInTheDocument();
  });
});
