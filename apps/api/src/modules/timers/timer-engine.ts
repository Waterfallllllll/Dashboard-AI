import {
  entityIdSchema,
  type TimerPatch,
  type TimerPhase,
  type TimerPreset,
  type TimerSession
} from "@dashboard/contracts";

import type { TimerRecord } from "./timers.types.js";

const POMODORO_CYCLE = 4;

export function normalizePreset(preset: TimerPreset): TimerPreset {
  if (preset.mode === "pomodoro") {
    return { mode: "pomodoro", workMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15 };
  }

  return {
    mode: preset.mode,
    workMinutes: preset.workMinutes,
    shortBreakMinutes: preset.shortBreakMinutes,
    longBreakMinutes: preset.longBreakMinutes
  };
}

export function phaseDurationMs(preset: TimerPreset, phase: TimerPhase): number {
  const normalized = normalizePreset(preset);

  if (normalized.mode === "manual") {
    return normalized.workMinutes * 60_000;
  }

  const minutes =
    phase === "work"
      ? normalized.workMinutes
      : phase === "short-break"
        ? normalized.shortBreakMinutes
        : normalized.longBreakMinutes;

  return minutes * 60_000;
}

export function nextInterval(
  preset: TimerPreset,
  phase: TimerPhase,
  cycleNumber: number
): { phase: TimerPhase; cycleNumber: number } {
  if (preset.mode === "manual") {
    return { phase: "work", cycleNumber: 0 };
  }

  if (phase === "work") {
    const completed = cycleNumber + 1;
    return {
      phase: completed >= POMODORO_CYCLE ? "long-break" : "short-break",
      cycleNumber: completed
    };
  }

  if (phase === "long-break") {
    return { phase: "work", cycleNumber: 0 };
  }

  return { phase: "work", cycleNumber };
}

export function remainingMs(session: TimerRecord, now: Date): number {
  if (session.completedAt) {
    return 0;
  }

  if (session.runStatus === "paused" && session.endsAt && session.pausedAt) {
    return Math.max(0, session.endsAt.getTime() - session.pausedAt.getTime());
  }

  if (session.runStatus === "running" && session.endsAt) {
    return Math.max(0, session.endsAt.getTime() - now.getTime());
  }

  return phaseDurationMs(session.preset, session.phase);
}

export function createRunningSession(input: {
  id: string;
  userId: string;
  preset: TimerPreset;
  phase: TimerPhase;
  cycleNumber: number;
  now: Date;
}): TimerRecord {
  const preset = normalizePreset(input.preset);
  const phase = preset.mode === "manual" ? "work" : input.phase;
  const duration = phaseDurationMs(preset, phase);

  return {
    id: input.id,
    userId: input.userId,
    preset,
    runStatus: "running",
    phase,
    startedAt: input.now,
    pausedAt: null,
    endsAt: new Date(input.now.getTime() + duration),
    completedAt: null,
    cycleNumber: input.cycleNumber,
    version: 1
  };
}

export function settleIfDue(session: TimerRecord, now: Date): TimerRecord {
  if (session.completedAt || session.runStatus !== "running" || !session.endsAt) {
    return session;
  }

  if (session.endsAt.getTime() > now.getTime()) {
    return session;
  }

  return {
    ...session,
    runStatus: "idle",
    completedAt: session.endsAt,
    version: session.version + 1
  };
}

export type TimerMutation =
  | { readonly kind: "update"; readonly session: TimerRecord }
  | { readonly kind: "invalid"; readonly message: string };

export function applyTimerAction(
  session: TimerRecord,
  action: TimerPatch["action"],
  now: Date
): TimerMutation {
  const settled = settleIfDue(session, now);

  if (settled.completedAt) {
    return { kind: "update", session: settled };
  }

  switch (action) {
    case "pause":
      return pause(settled, now);
    case "resume":
      return resume(settled, now);
    case "skip":
      return skip(settled, now);
    case "reset":
      return reset(settled, now);
    default: {
      const unknown: never = action;
      return unknown;
    }
  }
}

export function toTimerSessionDto(session: TimerRecord, now: Date): TimerSession {
  return {
    id: session.id,
    preset: session.preset,
    runStatus: session.completedAt ? "idle" : session.runStatus,
    phase: session.phase,
    startedAt: session.startedAt ? session.startedAt.toISOString() : null,
    pausedAt: session.pausedAt ? session.pausedAt.toISOString() : null,
    endsAt: session.endsAt ? session.endsAt.toISOString() : null,
    completedAt: session.completedAt ? session.completedAt.toISOString() : null,
    cycleNumber: session.cycleNumber,
    version: session.version,
    durationMs: phaseDurationMs(session.preset, session.phase),
    remainingMs: remainingMs(session, now)
  };
}

export function encodeTimerCursor(session: TimerRecord): string | null {
  if (!session.startedAt) {
    return null;
  }

  return Buffer.from(`${session.startedAt.toISOString()}|${session.id}`, "utf8").toString(
    "base64url"
  );
}

export function decodeTimerCursor(cursor: string): { startedAt: Date; id: string } | null {
  const decoded = decodeCursor(cursor);

  if (decoded === null) {
    return null;
  }

  const separator = decoded.lastIndexOf("|");

  if (separator <= 0) {
    return null;
  }

  const startedAt = new Date(decoded.slice(0, separator));
  const id = decoded.slice(separator + 1);

  if (Number.isNaN(startedAt.getTime()) || !entityIdSchema.safeParse(id).success) {
    return null;
  }

  return { startedAt, id };
}

function decodeCursor(cursor: string): string | null {
  try {
    return Buffer.from(cursor, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

function pause(session: TimerRecord, now: Date): TimerMutation {
  if (session.runStatus !== "running" || !session.endsAt) {
    return { kind: "invalid", message: "Пауза доступна только у идущего таймера." };
  }

  return {
    kind: "update",
    session: {
      ...session,
      runStatus: "paused",
      pausedAt: now,
      version: session.version + 1
    }
  };
}

function resume(session: TimerRecord, now: Date): TimerMutation {
  if (session.runStatus !== "paused" || !session.endsAt || !session.pausedAt) {
    return { kind: "invalid", message: "Продолжить можно только таймер на паузе." };
  }

  const remaining = session.endsAt.getTime() - session.pausedAt.getTime();

  if (remaining <= 0) {
    return {
      kind: "update",
      session: {
        ...session,
        runStatus: "idle",
        pausedAt: null,
        completedAt: now,
        version: session.version + 1
      }
    };
  }

  return {
    kind: "update",
    session: {
      ...session,
      runStatus: "running",
      pausedAt: null,
      endsAt: new Date(now.getTime() + remaining),
      version: session.version + 1
    }
  };
}

function skip(session: TimerRecord, now: Date): TimerMutation {
  if (session.runStatus === "idle") {
    return { kind: "invalid", message: "Пропускать нечего: таймер не запущен." };
  }

  return {
    kind: "update",
    session: {
      ...session,
      runStatus: "idle",
      pausedAt: null,
      endsAt: session.endsAt ?? now,
      completedAt: now,
      version: session.version + 1
    }
  };
}

function reset(session: TimerRecord, now: Date): TimerMutation {
  return {
    kind: "update",
    session: {
      ...session,
      runStatus: "idle",
      pausedAt: null,
      endsAt: null,
      completedAt: now,
      version: session.version + 1
    }
  };
}
