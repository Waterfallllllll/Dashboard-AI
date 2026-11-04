import type { TimerSettings } from "./timer-settings";
import { phaseDurationMs } from "./timer-settings";

export const WORK_DURATION_MS = 25 * 60 * 1000;
export const SHORT_BREAK_MS = 5 * 60 * 1000;
export const LONG_BREAK_MS = 15 * 60 * 1000;
export const POMODORO_CYCLE_LENGTH = 4;

export type TimerPhase = "work" | "short-break" | "long-break";
export type TimerRunStatus = "idle" | "running" | "paused";

export type TimerSession = Readonly<{
  mode: "pomodoro";
  phase: TimerPhase;
  runStatus: TimerRunStatus;
  durationMs: number;
  remainingMs: number;
  endsAt: number | null;
  completedWorkInCycle: number;
  completedWorkToday: number;
  dailyGoal: number;
}>;

export function createIdleTimer(): TimerSession {
  return {
    mode: "pomodoro",
    phase: "work",
    runStatus: "idle",
    durationMs: WORK_DURATION_MS,
    remainingMs: WORK_DURATION_MS,
    endsAt: null,
    completedWorkInCycle: 0,
    completedWorkToday: 2,
    dailyGoal: 8
  };
}

export function getDisplayedRemainingMs(session: TimerSession, now: number): number {
  if (session.runStatus === "running" && session.endsAt !== null) {
    return Math.max(0, session.endsAt - now);
  }

  return session.remainingMs;
}

export function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function getPhaseLabel(phase: TimerPhase): string {
  switch (phase) {
    case "work":
      return "Работа";
    case "short-break":
      return "Короткий отдых";
    case "long-break":
      return "Длинный отдых";
  }
}

export function getPhaseDuration(phase: TimerPhase): number {
  switch (phase) {
    case "work":
      return WORK_DURATION_MS;
    case "short-break":
      return SHORT_BREAK_MS;
    case "long-break":
      return LONG_BREAK_MS;
  }
}

export function getNextPhase(session: TimerSession): TimerPhase {
  if (session.phase === "work") {
    return session.completedWorkInCycle + 1 >= POMODORO_CYCLE_LENGTH ? "long-break" : "short-break";
  }

  return "work";
}

export function getNextPhaseLabel(session: TimerSession, settings?: TimerSettings): string {
  if (settings?.mode === "manual") {
    return "Один интервал, без перерыва";
  }

  const next = getNextPhase(session);
  const minutes = Math.round(
    (settings ? phaseDurationMs(next, settings) : getPhaseDuration(next)) / 60_000
  );
  return `Далее: ${getPhaseLabel(next).toLocaleLowerCase("ru")} ${minutes} мин`;
}

export function startTimer(session: TimerSession, now: number): TimerSession {
  const remainingMs = session.runStatus === "paused" ? session.remainingMs : session.durationMs;

  return {
    ...session,
    runStatus: "running",
    remainingMs,
    endsAt: now + remainingMs
  };
}

export function pauseTimer(session: TimerSession, now: number): TimerSession {
  return {
    ...session,
    runStatus: "paused",
    remainingMs: getDisplayedRemainingMs(session, now),
    endsAt: null
  };
}

export function resetTimer(): TimerSession {
  return {
    ...createIdleTimer(),
    completedWorkToday: 0,
    completedWorkInCycle: 0
  };
}

export function completeCurrentPhase(
  session: TimerSession,
  settings?: TimerSettings
): TimerSession {
  const finishedWork = session.phase === "work";

  if (settings?.mode === "manual") {
    const durationMs = phaseDurationMs("work", settings);

    return {
      ...session,
      phase: "work",
      runStatus: "idle",
      durationMs,
      remainingMs: durationMs,
      endsAt: null,
      completedWorkToday: finishedWork ? session.completedWorkToday + 1 : session.completedWorkToday
    };
  }

  const nextPhase = getNextPhase(session);
  const durationMs = settings ? phaseDurationMs(nextPhase, settings) : getPhaseDuration(nextPhase);
  let completedWorkInCycle = session.completedWorkInCycle;

  if (finishedWork) {
    completedWorkInCycle += 1;
  }

  if (session.phase === "long-break") {
    completedWorkInCycle = 0;
  }

  return {
    ...session,
    phase: nextPhase,
    runStatus: "idle",
    durationMs,
    remainingMs: durationMs,
    endsAt: null,
    completedWorkInCycle,
    completedWorkToday: finishedWork ? session.completedWorkToday + 1 : session.completedWorkToday
  };
}

export function skipPhase(session: TimerSession, settings?: TimerSettings): TimerSession {
  return completeCurrentPhase(session, settings);
}

export function completePhaseIfDue(
  session: TimerSession,
  now: number,
  settings?: TimerSettings
): TimerSession {
  if (session.runStatus !== "running" || getDisplayedRemainingMs(session, now) > 0) {
    return session;
  }

  return completeCurrentPhase(session, settings);
}

export function isTimerActive(session: TimerSession): boolean {
  return session.runStatus === "running" || session.runStatus === "paused";
}
