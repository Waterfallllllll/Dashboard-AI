import { describe, expect, it } from "vitest";

import {
  applyTimerAction,
  createRunningSession,
  nextInterval,
  remainingMs
} from "./timer-engine.js";

const start = new Date("2026-11-11T09:00:00.000Z");
const userId = "a".repeat(24);

function running(minutes = 25) {
  return createRunningSession({
    id: "b".repeat(24),
    userId,
    preset: {
      mode: "custom",
      workMinutes: minutes,
      shortBreakMinutes: 5,
      longBreakMinutes: 15
    },
    phase: "work",
    cycleNumber: 0,
    now: start
  });
}

describe("ход таймера", () => {
  it("считает паузу от абсолютного конца и продолжает с тем же остатком", () => {
    const session = running();
    const paused = applyTimerAction(session, "pause", new Date(start.getTime() + 60_000));
    expect(paused.kind).toBe("update");

    if (paused.kind !== "update") {
      return;
    }

    expect(remainingMs(paused.session, new Date(start.getTime() + 120_000))).toBe(24 * 60_000);
    const resumed = applyTimerAction(paused.session, "resume", new Date(start.getTime() + 180_000));

    if (resumed.kind !== "update") {
      throw new Error("Продолжение не применилось");
    }

    expect(resumed.session.endsAt?.toISOString()).toBe("2026-11-11T09:27:00.000Z");
    expect(resumed.session.pausedAt).toBeNull();
  });

  it("закрывает истёкший интервал по endsAt, а сброс не записывает его в журнал", () => {
    const due = applyTimerAction(running(1), "pause", new Date(start.getTime() + 60_000));

    if (due.kind !== "update") {
      throw new Error("Интервал не закрылся");
    }

    expect(due.session.completedAt?.toISOString()).toBe("2026-11-11T09:01:00.000Z");
    expect(due.session.endsAt).not.toBeNull();

    const cleared = applyTimerAction(running(), "reset", new Date(start.getTime() + 5_000));

    if (cleared.kind !== "update") {
      throw new Error("Сброс не применился");
    }

    expect(cleared.session.endsAt).toBeNull();
    expect(cleared.session.completedAt).not.toBeNull();
  });

  it("после четвёртой работы предлагает длинный перерыв", () => {
    expect(
      nextInterval(
        { mode: "pomodoro", workMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15 },
        "work",
        3
      )
    ).toEqual({ phase: "long-break", cycleNumber: 4 });
    expect(
      nextInterval(
        { mode: "pomodoro", workMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15 },
        "long-break",
        4
      )
    ).toEqual({ phase: "work", cycleNumber: 0 });
  });
});
