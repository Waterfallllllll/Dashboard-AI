import {
  CSRF_HEADER,
  IDEMPOTENCY_KEY_HEADER,
  sessionResponseSchema,
  timerPatchSchema,
  timerSnapshotResponseSchema,
  timerStartSchema,
  type TimerPatch,
  type TimerPreset,
  type TimerSnapshot
} from "@dashboard/contracts";

import type { TimerSession } from "../model/timer-state";
import type { TimerSettings } from "../model/timer-settings";
import { timerSessionFromSnapshot } from "../model/timer-snapshot";

export type TimerCommandAction = "start" | Exclude<TimerPatch["action"], "resume">;

export type TimerCommandInput = Readonly<{
  action: TimerCommandAction;
  session: TimerSession;
  settings?: TimerSettings;
}>;

export type RunTimerCommand = (
  input: TimerCommandInput,
  fetchImpl?: typeof fetch
) => Promise<TimerSession>;

type TimerClientCode = "unauthenticated" | "conflict" | "unavailable";

export class TimerClientError extends Error {
  readonly code: TimerClientCode;

  constructor(code: TimerClientCode) {
    super(
      code === "unauthenticated"
        ? "Войдите в аккаунт, чтобы запустить таймер."
        : code === "conflict"
          ? "Таймер уже изменился. Повторите действие."
          : "Не удалось синхронизировать таймер."
    );
    this.name = "TimerClientError";
    this.code = code;
  }
}

export const runTimerCommand: RunTimerCommand = async (input, fetchImpl = fetch) => {
  const current = await loadCurrentTimer(fetchImpl);
  const active = current.session;

  if (input.action === "start") {
    if (active?.runStatus === "paused") {
      return timerSessionFromSnapshot(
        await patchTimer(active.id, active.version, "resume", fetchImpl)
      );
    }

    if (active) {
      return timerSessionFromSnapshot(current);
    }

    try {
      return timerSessionFromSnapshot(await startTimer(input, fetchImpl));
    } catch (error) {
      if (error instanceof TimerClientError && error.code === "conflict") {
        return timerSessionFromSnapshot(await loadCurrentTimer(fetchImpl));
      }

      throw error;
    }
  }

  if (!active || (input.action === "pause" && active.runStatus !== "running")) {
    return timerSessionFromSnapshot(current);
  }

  return timerSessionFromSnapshot(
    await patchTimer(active.id, active.version, input.action, fetchImpl)
  );
};

async function loadCurrentTimer(fetchImpl: typeof fetch): Promise<TimerSnapshot> {
  const response = await request(
    fetchImpl("/api/v1/timers/current", {
      cache: "no-store",
      credentials: "same-origin",
      headers: { Accept: "application/json" }
    })
  );

  return readSnapshot(response);
}

async function startTimer(
  input: TimerCommandInput,
  fetchImpl: typeof fetch
): Promise<TimerSnapshot> {
  const body = timerStartSchema.safeParse({
    preset: presetFrom(input.settings),
    phase: input.settings?.mode === "manual" ? "work" : input.session.phase,
    cycleNumber: input.settings?.mode === "manual" ? 0 : input.session.completedWorkInCycle
  });

  if (!body.success) {
    throw new TimerClientError("unavailable");
  }

  const response = await request(
    fetchImpl("/api/v1/timers", {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
      headers: await mutationHeaders(fetchImpl, newIdempotencyKey()),
      body: JSON.stringify(body.data)
    })
  );

  return readSnapshot(response);
}

async function patchTimer(
  id: string,
  version: number,
  action: TimerPatch["action"],
  fetchImpl: typeof fetch
): Promise<TimerSnapshot> {
  const body = timerPatchSchema.safeParse({ action, version });

  if (!body.success) {
    throw new TimerClientError("unavailable");
  }

  const response = await request(
    fetchImpl(`/api/v1/timers/${encodeURIComponent(id)}`, {
      method: "PATCH",
      cache: "no-store",
      credentials: "same-origin",
      headers: await mutationHeaders(fetchImpl),
      body: JSON.stringify(body.data)
    })
  );

  return readSnapshot(response);
}

function presetFrom(settings: TimerSettings | undefined): TimerPreset {
  if (!settings) {
    return {
      mode: "pomodoro",
      workMinutes: 25,
      shortBreakMinutes: 5,
      longBreakMinutes: 15
    };
  }

  return {
    mode: settings.mode,
    workMinutes: settings.mode === "manual" ? settings.manualMinutes : settings.workMinutes,
    shortBreakMinutes: settings.shortBreakMinutes,
    longBreakMinutes: settings.longBreakMinutes
  };
}

async function mutationHeaders(fetchImpl: typeof fetch, idempotencyKey?: string): Promise<Headers> {
  const headers = new Headers({
    Accept: "application/json",
    "Content-Type": "application/json",
    [CSRF_HEADER]: await readCsrfToken(fetchImpl)
  });

  if (idempotencyKey) {
    headers.set(IDEMPOTENCY_KEY_HEADER, idempotencyKey);
  }

  return headers;
}

async function readCsrfToken(fetchImpl: typeof fetch): Promise<string> {
  const response = await request(
    fetchImpl("/api/v1/auth/session", {
      cache: "no-store",
      credentials: "same-origin",
      headers: { Accept: "application/json" }
    })
  );
  const parsed = sessionResponseSchema.safeParse(await readJson(response));

  if (!parsed.success) {
    throw new TimerClientError("unavailable");
  }

  return parsed.data.data.csrfToken;
}

async function request(pending: Promise<Response>): Promise<Response> {
  let response: Response;

  try {
    response = await pending;
  } catch {
    throw new TimerClientError("unavailable");
  }

  if (response.status === 401) {
    throw new TimerClientError("unauthenticated");
  }

  if (response.status === 409) {
    throw new TimerClientError("conflict");
  }

  if (!response.ok) {
    throw new TimerClientError("unavailable");
  }

  return response;
}

async function readSnapshot(response: Response): Promise<TimerSnapshot> {
  const parsed = timerSnapshotResponseSchema.safeParse(await readJson(response));

  if (!parsed.success) {
    throw new TimerClientError("unavailable");
  }

  return parsed.data.data;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function newIdempotencyKey(): string {
  const suffix =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;

  return `timer-${suffix}`;
}
