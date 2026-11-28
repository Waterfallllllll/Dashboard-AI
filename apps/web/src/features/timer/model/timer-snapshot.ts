import type { TimerPreset, TimerSnapshot } from "@dashboard/contracts";

import type { TimerPhase, TimerSession } from "./timer-state";
import { getPhaseDuration } from "./timer-state";

export function timerSessionFromSnapshot(snapshot: TimerSnapshot): TimerSession {
  const active = snapshot.session;
  const source = active ?? snapshot.settled;
  const phase = active?.phase ?? snapshot.next.phase;
  const durationMs = active?.durationMs ?? durationFor(source?.preset, phase);

  return {
    mode: "pomodoro",
    phase,
    runStatus: active?.runStatus ?? "idle",
    durationMs,
    remainingMs: active?.remainingMs ?? durationMs,
    endsAt: active?.endsAt ? Date.parse(active.endsAt) : null,
    completedWorkInCycle: active?.cycleNumber ?? snapshot.next.cycleNumber,
    completedWorkToday: snapshot.completedToday,
    dailyGoal: snapshot.dailyGoal
  };
}

function durationFor(preset: TimerPreset | undefined, phase: TimerPhase): number {
  if (!preset || preset.mode === "pomodoro") {
    return getPhaseDuration(phase);
  }

  if (preset.mode === "manual") {
    return preset.workMinutes * 60_000;
  }

  const minutes =
    phase === "work"
      ? preset.workMinutes
      : phase === "short-break"
        ? preset.shortBreakMinutes
        : preset.longBreakMinutes;

  return minutes * 60_000;
}
