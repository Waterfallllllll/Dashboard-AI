export const WORK_JOB_TYPES = [
  "timer-due",
  "deliver-notification",
  "refresh-news",
  "sync-calendar",
  "scan-due-timers",
  "scan-routine-reminders",
  "purge-revoked-push",
  "renew-calendar-watch",
  "purge-expired"
] as const;

export const INFRASTRUCTURE_JOB_TYPES = ["scheduler-lock", "worker-heartbeat"] as const;

export const JOB_TYPES = [...WORK_JOB_TYPES, ...INFRASTRUCTURE_JOB_TYPES] as const;

export type WorkJobType = (typeof WORK_JOB_TYPES)[number];
export type JobType = (typeof JOB_TYPES)[number];
export type JobStatus = "pending" | "processing" | "completed" | "failed";

export type JobPayload = {
  readonly sessionId?: string;
  readonly eventType?: "work" | "break" | "routine" | "calendar";
  readonly channel?: "browser" | "telegram" | "in_app";
  readonly ruleId?: string;
  readonly localDate?: string;
  readonly title?: string;
  readonly channelId?: string;
  readonly phase?: "work" | "short-break" | "long-break";
};

export type ScheduleJob = {
  readonly type: WorkJobType;
  readonly payload: JobPayload;
  readonly runAt: Date;
  readonly idempotencyKey: string;
  readonly userId: string | null;
  readonly maxAttempts: number;
};

export type ClaimedJob = {
  readonly id: string;
  readonly type: JobType;
  readonly payload: JobPayload;
  readonly idempotencyKey: string;
  readonly userId: string | null;
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly runAt: Date;
};

export type JobSignal =
  | { readonly kind: "done" }
  | { readonly kind: "retry"; readonly code: string }
  | { readonly kind: "fail"; readonly code: string }
  | { readonly kind: "reschedule"; readonly runAt: Date };

export type QueueCounts = Record<JobStatus, number>;

const KEY_PATTERN = /^[A-Za-z0-9:_-]{8,200}$/;
const ERROR_CODE_PATTERN = /^[a-z0-9-]{1,40}$/;

export function assertIdempotencyKey(key: string): void {
  if (!KEY_PATTERN.test(key)) {
    throw new Error("Некорректный ключ идемпотентности задачи");
  }
}

export function safeJobCode(code: string): string {
  return ERROR_CODE_PATTERN.test(code) ? code : "unexpected";
}

export function retryDelayMs(attempt: number): number {
  const shift = Math.min(8, Math.max(0, attempt - 1));
  return Math.min(15 * 60 * 1000, 5_000 * 2 ** shift);
}

export function emptyCounts(): QueueCounts {
  return { pending: 0, processing: 0, completed: 0, failed: 0 };
}

export function definedPayload(payload: JobPayload): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === "string" && value.length > 0) {
      result[key] = value;
    }
  }

  return result;
}
