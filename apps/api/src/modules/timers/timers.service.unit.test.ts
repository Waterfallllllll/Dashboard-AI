import { describe, expect, it } from "vitest";

import { TIMER_ALREADY_RUNNING } from "@dashboard/contracts";

import { MemoryTimersRepository } from "../personal-memory.js";
import { TimersService } from "./timers.service.js";

const actor = { userId: "a".repeat(24), sessionId: "session" };
const start = new Date("2026-11-11T09:00:00.000Z");
let clock = start;

const preset = {
  mode: "custom" as const,
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15
};

function service() {
  return new TimersService(
    new MemoryTimersRepository(),
    {
      async dailyGoal() {
        return 8;
      }
    },
    () => clock
  );
}

describe("таймер", () => {
  it("держит один незавершённый интервал и закрывает его по endsAt", async () => {
    const timers = service();
    const started = await timers.start(
      actor,
      { preset },
      "2026-11-11",
      "Europe/Moscow",
      "timer-key-0001"
    );
    expect(started.snapshot.session?.endsAt).toBe("2026-11-11T09:25:00.000Z");
    const replay = await timers.start(
      actor,
      { preset: { ...preset, workMinutes: 10 } },
      "2026-11-11",
      "Europe/Moscow",
      "timer-key-0001"
    );
    expect(replay.replayed).toBe(true);
    expect(replay.snapshot.session?.id).toBe(started.snapshot.session?.id);

    await expect(
      timers.start(actor, { preset }, "2026-11-11", "Europe/Moscow", null)
    ).rejects.toMatchObject({ code: TIMER_ALREADY_RUNNING });

    clock = new Date(start.getTime() + 25 * 60_000);
    const due = await timers.current(actor, "2026-11-11", "Europe/Moscow");
    expect(due.session).toBeNull();
    expect(due.settled?.completedAt).toBe("2026-11-11T09:25:00.000Z");
    expect(due.completedToday).toBe(1);
    expect(due.next).toEqual({ phase: "short-break", cycleNumber: 1 });
  });

  it("не считает сброшенный интервал завершённой работой", async () => {
    clock = start;
    const timers = service();
    const started = await timers.start(actor, { preset }, "2026-11-11", "Europe/Moscow", null);
    const id = started.snapshot.session?.id;
    const version = started.snapshot.session?.version;

    if (!id || !version) {
      throw new Error("Сессия не запустилась");
    }

    const cleared = await timers.update(
      actor,
      id,
      { action: "reset", version },
      "2026-11-11",
      "Europe/Moscow"
    );
    expect(cleared.session).toBeNull();
    expect(cleared.settled?.endsAt).toBeNull();
    expect(cleared.completedToday).toBe(0);
  });
});
