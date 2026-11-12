import { describe, expect, it } from "vitest";

import { timerPatchSchema, timerStartSchema } from "./timers.js";

describe("таймер", () => {
  it("принимает запуск и отклоняет длительность вне диапазона, ручной перерыв и подмену endsAt", () => {
    expect(
      timerStartSchema.parse({
        preset: { mode: "pomodoro", workMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15 }
      }).preset.mode
    ).toBe("pomodoro");
    expect(
      timerStartSchema.safeParse({
        preset: { mode: "custom", workMinutes: 0, shortBreakMinutes: 5, longBreakMinutes: 15 }
      }).success
    ).toBe(false);
    expect(
      timerStartSchema.safeParse({
        preset: { mode: "manual", workMinutes: 10, shortBreakMinutes: 5, longBreakMinutes: 15 },
        phase: "short-break"
      }).success
    ).toBe(false);
    expect(
      timerPatchSchema.safeParse({
        action: "pause",
        version: 1,
        endsAt: "2026-11-11T12:00:00.000Z"
      }).success
    ).toBe(false);
    expect(timerPatchSchema.parse({ action: "reset", version: 2 }).action).toBe("reset");
  });
});
