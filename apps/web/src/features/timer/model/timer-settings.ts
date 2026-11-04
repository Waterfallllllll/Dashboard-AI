import type { TimerPhase, TimerSession } from "./timer-state";

export const TIMER_SETTINGS_STORAGE_KEY = "evergreen-timer-settings";

export type TimerMode = "pomodoro" | "custom" | "manual";

export type TimerSettings = Readonly<{
  mode: TimerMode;
  workMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  manualMinutes: number;
  volume: number;
  dailyGoal: number;
}>;

export type FocusEntry = Readonly<{
  id: string;
  endedAt: number;
  minutes: number;
}>;

export const DEFAULT_TIMER_SETTINGS: TimerSettings = {
  mode: "pomodoro",
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  manualMinutes: 25,
  volume: 0.4,
  dailyGoal: 8
};

export function clampMinutes(value: number): number {
  if (!Number.isFinite(value)) {
    return 25;
  }

  return Math.min(120, Math.max(1, Math.round(value)));
}

export function clampGoal(value: number): number {
  if (!Number.isFinite(value)) {
    return 8;
  }

  return Math.min(24, Math.max(1, Math.round(value)));
}

export function clampVolume(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}

export function phaseDurationMs(phase: TimerPhase, settings: TimerSettings): number {
  if (settings.mode === "manual") {
    return clampMinutes(settings.manualMinutes) * 60_000;
  }

  if (settings.mode === "custom") {
    const minutes =
      phase === "work"
        ? settings.workMinutes
        : phase === "short-break"
          ? settings.shortBreakMinutes
          : settings.longBreakMinutes;

    return clampMinutes(minutes) * 60_000;
  }

  if (phase === "work") {
    return 25 * 60_000;
  }

  if (phase === "short-break") {
    return 5 * 60_000;
  }

  return 15 * 60_000;
}

export function alignIdleSession(session: TimerSession, settings: TimerSettings): TimerSession {
  const dailyGoal = clampGoal(settings.dailyGoal);

  if (session.runStatus === "running") {
    return session.dailyGoal === dailyGoal ? session : { ...session, dailyGoal };
  }

  if (session.runStatus === "paused" && settings.mode === "pomodoro") {
    return session.dailyGoal === dailyGoal ? session : { ...session, dailyGoal };
  }

  const durationMs = phaseDurationMs(session.phase, settings);
  const remainingMs =
    session.runStatus === "paused" ? Math.min(session.remainingMs, durationMs) : durationMs;

  if (
    session.durationMs === durationMs &&
    session.remainingMs === remainingMs &&
    session.dailyGoal === dailyGoal &&
    session.endsAt === null
  ) {
    return session;
  }

  return {
    ...session,
    durationMs,
    remainingMs,
    endsAt: null,
    dailyGoal
  };
}

export function parseTimerSettings(rawValue: string | null): TimerSettings {
  if (!rawValue) {
    return DEFAULT_TIMER_SETTINGS;
  }

  try {
    const parsedValue: unknown = JSON.parse(rawValue);

    if (typeof parsedValue !== "object" || parsedValue === null) {
      return DEFAULT_TIMER_SETTINGS;
    }

    const record = parsedValue as Record<string, unknown>;
    const mode = record.mode === "custom" || record.mode === "manual" ? record.mode : "pomodoro";

    return {
      mode,
      workMinutes: clampMinutes(numberOr(record.workMinutes, 25)),
      shortBreakMinutes: clampMinutes(numberOr(record.shortBreakMinutes, 5)),
      longBreakMinutes: clampMinutes(numberOr(record.longBreakMinutes, 15)),
      manualMinutes: clampMinutes(numberOr(record.manualMinutes, 25)),
      volume: clampVolume(numberOr(record.volume, 0.4)),
      dailyGoal: clampGoal(numberOr(record.dailyGoal, 8))
    };
  } catch {
    return DEFAULT_TIMER_SETTINGS;
  }
}

export function parseFocusJournal(rawValue: unknown): FocusEntry[] {
  if (!Array.isArray(rawValue)) {
    return [];
  }

  return rawValue
    .slice(-20)
    .map((entry) => {
      if (typeof entry !== "object" || entry === null) {
        return null;
      }

      const record = entry as Record<string, unknown>;

      if (typeof record.id !== "string" || typeof record.endedAt !== "number") {
        return null;
      }

      return {
        id: record.id.slice(0, 80),
        endedAt: record.endedAt,
        minutes: clampMinutes(numberOr(record.minutes, 1))
      };
    })
    .filter((entry): entry is FocusEntry => entry !== null);
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" ? value : fallback;
}
