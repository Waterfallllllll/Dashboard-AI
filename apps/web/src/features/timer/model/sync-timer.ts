import {
  timerSnapshotResponseSchema,
  type TimerSnapshot
} from "@dashboard/contracts";

import { browserApi } from "@/lib/api/browser-api-client";
import { getCsrfToken } from "@/lib/api/csrf-memory";

import { getTimerSettingsSnapshot } from "./timer-settings-store";
import type { TimerSession } from "./timer-state";

let remoteTimer: { id: string; version: number } | null = null;

export function rememberRemoteTimer(next: { id: string; version: number } | null): void {
  remoteTimer = next;
}

export async function syncTimerAction(previous: TimerSession, next: TimerSession): Promise<void> {
  if (!getCsrfToken()) {
    return;
  }

  if (next.runStatus === "running" && previous.runStatus === "paused" && remoteTimer) {
    await patchTimer("resume");
    return;
  }

  if (next.runStatus === "running" && previous.runStatus !== "running") {
    await startTimer(next);
    return;
  }

  if (next.runStatus === "paused" && previous.runStatus === "running") {
    await patchTimer("pause");
    return;
  }

  if (next.runStatus === "idle" && previous.runStatus !== "idle") {
    const reset =
      next.phase === "work" && next.completedWorkInCycle === 0 && next.completedWorkToday === 0;
    await patchTimer(reset ? "reset" : "skip");

    if (reset) {
      remoteTimer = null;
    }
  }
}

async function startTimer(next: TimerSession): Promise<void> {
  const settings = getTimerSettingsSnapshot().settings;
  const workMinutes = settings.mode === "manual" ? settings.manualMinutes : settings.workMinutes;
  const result = await browserApi({
    path: "/api/v1/timers",
    method: "POST",
    schema: timerSnapshotResponseSchema,
    idempotencyKey: crypto.randomUUID(),
    body: {
      preset: {
        mode: settings.mode,
        workMinutes,
        shortBreakMinutes: settings.shortBreakMinutes,
        longBreakMinutes: settings.longBreakMinutes
      },
      phase: settings.mode === "manual" ? "work" : next.phase
    }
  });

  if (!result.ok) {
    return;
  }

  rememberSnapshot(result.data.data);
}

async function patchTimer(action: "pause" | "resume" | "skip" | "reset"): Promise<void> {
  if (!remoteTimer) {
    return;
  }

  const result = await browserApi({
    path: `/api/v1/timers/${remoteTimer.id}`,
    method: "PATCH",
    schema: timerSnapshotResponseSchema,
    body: { action, version: remoteTimer.version }
  });

  if (!result.ok) {
    return;
  }

  rememberSnapshot(result.data.data);
}

function rememberSnapshot(snapshot: TimerSnapshot): void {
  if (!snapshot.session) {
    remoteTimer = null;
    return;
  }

  remoteTimer = { id: snapshot.session.id, version: snapshot.session.version };
}
