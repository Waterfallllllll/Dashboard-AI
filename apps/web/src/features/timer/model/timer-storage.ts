import { createIdleTimer, type TimerSession } from "./timer-state";

export const TIMER_STORAGE_KEY = "evergreen-timer-mock";

export function parseTimerSession(rawValue: string | null): TimerSession | null {
  if (!rawValue) {
    return null;
  }

  try {
    const parsedValue: unknown = JSON.parse(rawValue);

    if (
      typeof parsedValue === "object" &&
      parsedValue !== null &&
      "mode" in parsedValue &&
      parsedValue.mode === "pomodoro" &&
      "phase" in parsedValue &&
      (parsedValue.phase === "work" ||
        parsedValue.phase === "short-break" ||
        parsedValue.phase === "long-break") &&
      "runStatus" in parsedValue &&
      (parsedValue.runStatus === "idle" ||
        parsedValue.runStatus === "running" ||
        parsedValue.runStatus === "paused") &&
      "durationMs" in parsedValue &&
      typeof parsedValue.durationMs === "number" &&
      "remainingMs" in parsedValue &&
      typeof parsedValue.remainingMs === "number" &&
      "endsAt" in parsedValue &&
      (typeof parsedValue.endsAt === "number" || parsedValue.endsAt === null) &&
      "completedWorkInCycle" in parsedValue &&
      typeof parsedValue.completedWorkInCycle === "number" &&
      "completedWorkToday" in parsedValue &&
      typeof parsedValue.completedWorkToday === "number" &&
      "dailyGoal" in parsedValue &&
      typeof parsedValue.dailyGoal === "number"
    ) {
      return {
        mode: "pomodoro",
        phase: parsedValue.phase,
        runStatus: parsedValue.runStatus,
        durationMs: parsedValue.durationMs,
        remainingMs: parsedValue.remainingMs,
        endsAt: parsedValue.endsAt,
        completedWorkInCycle: parsedValue.completedWorkInCycle,
        completedWorkToday: parsedValue.completedWorkToday,
        dailyGoal: parsedValue.dailyGoal
      };
    }
  } catch {
    return null;
  }

  return null;
}

export function readTimerSession(): TimerSession {
  if (typeof window === "undefined") {
    return createIdleTimer();
  }

  try {
    return parseTimerSession(window.localStorage.getItem(TIMER_STORAGE_KEY)) ?? createIdleTimer();
  } catch {
    return createIdleTimer();
  }
}

export function writeTimerSession(session: TimerSession): void {
  try {
    window.localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Локальное сохранение мок-сессии не должно ломать виджет.
  }
}
