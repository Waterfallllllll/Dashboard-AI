import { describe, expect, it } from "vitest";

import {
  completePhaseIfDue,
  createIdleTimer,
  formatRemaining,
  getDisplayedRemainingMs,
  getNextPhase,
  pauseTimer,
  skipPhase,
  startTimer,
  WORK_DURATION_MS
} from "./timer-state";

describe("timer state", () => {
  it("считает остаток по endsAt, а не по тикам", () => {
    const started = startTimer(createIdleTimer(), 1_000);
    expect(started.endsAt).toBe(1_000 + WORK_DURATION_MS);
    expect(getDisplayedRemainingMs(started, 1_000 + 5_000)).toBe(WORK_DURATION_MS - 5_000);
    expect(formatRemaining(65_000)).toBe("01:05");
  });

  it("ставит на паузу с сохранённым остатком", () => {
    const paused = pauseTimer(startTimer(createIdleTimer(), 0), 10_000);
    expect(paused.runStatus).toBe("paused");
    expect(paused.endsAt).toBeNull();
    expect(paused.remainingMs).toBe(WORK_DURATION_MS - 10_000);
  });

  it("после работы переходит к короткому отдыху, после четырёх — к длинному", () => {
    const skipped = skipPhase(createIdleTimer());
    expect(getNextPhase(createIdleTimer())).toBe("short-break");
    expect(getNextPhase({ ...createIdleTimer(), completedWorkInCycle: 3 })).toBe("long-break");
    expect(skipped.phase).toBe("short-break");
    expect(skipped.completedWorkToday).toBe(3);
  });

  it("завершает фазу, когда now достигает endsAt", () => {
    const started = startTimer(createIdleTimer(), 0);
    const completed = completePhaseIfDue(started, started.endsAt ?? 0);
    expect(completed.phase).toBe("short-break");
    expect(completed.runStatus).toBe("idle");
  });
});
