import {
  retryDelayMs,
  type ClaimedJob,
  type JobSignal,
  type ScheduleJob,
  type WorkJobType
} from "./job-types.js";
import type { JobQueue } from "./memory-job-queue.js";

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export type WorkerJobEvent = {
  readonly id: string;
  readonly type: ClaimedJob["type"];
  readonly attempt: number;
  readonly outcome: JobSignal["kind"];
  readonly durationMs: number;
  readonly userId?: string;
};

export type WorkerHandlers = {
  timerDue(userId: string, sessionId: string): Promise<JobSignal>;
  deliver(job: ClaimedJob): Promise<JobSignal>;
  refreshNews(): Promise<void>;
  syncCalendar(userId: string | null): Promise<void>;
  scanTimers(): Promise<void>;
  scanRoutines(): Promise<void>;
  purgePush(): Promise<void>;
  renewWatches(): Promise<void>;
  purgeExpired?(): Promise<void>;
};

export function periodicJobs(now: Date, maxAttempts: number): readonly ScheduleJob[] {
  return [
    slot("refresh-news", now, 15 * MINUTE_MS, maxAttempts),
    slot("scan-due-timers", now, 30_000, maxAttempts),
    slot("scan-routine-reminders", now, MINUTE_MS, maxAttempts),
    slot("sync-calendar", now, 30 * MINUTE_MS, maxAttempts),
    slot("purge-revoked-push", now, DAY_MS, maxAttempts),
    slot("renew-calendar-watch", now, DAY_MS, maxAttempts),
    slot("purge-expired", now, 60 * MINUTE_MS, maxAttempts)
  ];
}

export async function runWorkerCycle(input: {
  readonly jobs: JobQueue;
  readonly workerId: string;
  readonly now: Date;
  readonly leaseMs: number;
  readonly retentionMs: number;
  readonly maxAttempts: number;
  readonly handlers: WorkerHandlers;
  readonly onJob?: (event: WorkerJobEvent) => void;
}): Promise<"idle" | "processed"> {
  const now = input.now;
  await input.jobs.touchHeartbeat(input.workerId, now);
  await input.jobs.releaseExpired(now);
  const locked = await input.jobs.tryLock(
    "scheduler",
    input.workerId,
    now,
    Math.max(input.leaseMs, 30_000)
  );

  if (locked) {
    for (const job of periodicJobs(now, input.maxAttempts)) {
      await input.jobs.schedule(job);
    }
  }

  const claimed = await input.jobs.claim(input.workerId, now, input.leaseMs);

  if (!claimed) {
    return "idle";
  }

  const deleteAt = new Date(now.getTime() + input.retentionMs);
  const started = Date.now();
  let signal: JobSignal;

  try {
    signal = await dispatch(claimed, input.handlers);
  } catch {
    signal = { kind: "retry", code: "unexpected" };
  }

  input.onJob?.({
    id: claimed.id,
    type: claimed.type,
    attempt: claimed.attempts,
    outcome: signal.kind,
    durationMs: Date.now() - started,
    ...(claimed.userId ? { userId: claimed.userId } : {})
  });

  if (signal.kind === "reschedule") {
    await input.jobs.reschedule(claimed.id, input.workerId, signal.runAt, now);
    return "processed";
  }

  if (signal.kind === "fail") {
    await input.jobs.fail(claimed.id, input.workerId, now, signal.code, deleteAt);
    return "processed";
  }

  if (signal.kind === "retry") {
    const nextRunAt = new Date(now.getTime() + retryDelayMs(claimed.attempts));
    await input.jobs.retry(claimed.id, input.workerId, now, nextRunAt, signal.code, deleteAt);
    return "processed";
  }

  await input.jobs.complete(claimed.id, input.workerId, now, deleteAt);
  return "processed";
}

async function dispatch(job: ClaimedJob, handlers: WorkerHandlers): Promise<JobSignal> {
  switch (job.type) {
    case "timer-due":
      if (!job.userId || !job.payload.sessionId) {
        return { kind: "fail", code: "invalid-payload" };
      }

      return handlers.timerDue(job.userId, job.payload.sessionId);
    case "deliver-notification":
      return handlers.deliver(job);
    case "refresh-news":
      await handlers.refreshNews();
      return { kind: "done" };
    case "sync-calendar":
      await handlers.syncCalendar(job.userId);
      return { kind: "done" };
    case "scan-due-timers":
      await handlers.scanTimers();
      return { kind: "done" };
    case "scan-routine-reminders":
      await handlers.scanRoutines();
      return { kind: "done" };
    case "purge-revoked-push":
      await handlers.purgePush();
      return { kind: "done" };
    case "renew-calendar-watch":
      await handlers.renewWatches();
      return { kind: "done" };
    case "purge-expired":
      if (!handlers.purgeExpired) {
        return { kind: "fail", code: "purge-unwired" };
      }

      await handlers.purgeExpired();
      return { kind: "done" };
    case "scheduler-lock":
    case "worker-heartbeat":
      return { kind: "done" };
    default: {
      const unknown: never = job.type;
      return unknown;
    }
  }
}

function slot(type: WorkJobType, now: Date, intervalMs: number, maxAttempts: number): ScheduleJob {
  const bucket = Math.floor(now.getTime() / intervalMs);
  return {
    type,
    payload: {},
    runAt: new Date(bucket * intervalMs),
    idempotencyKey: `schedule:${type}:${bucket}`,
    userId: null,
    maxAttempts
  };
}
