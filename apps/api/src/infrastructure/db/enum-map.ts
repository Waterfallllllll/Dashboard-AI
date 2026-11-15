import type { TimeFormat as DomainTimeFormat } from "@dashboard/contracts";
import type { TimerPhase as DomainTimerPhase } from "@dashboard/contracts";

import { ScheduledJobType, TimeFormat, TimerPhase } from "../../generated/prisma/client.js";
import type { JobType } from "../jobs/job-types.js";

const JOB_TO_PRISMA = {
  "timer-due": ScheduledJobType.timerDue,
  "deliver-notification": ScheduledJobType.deliverNotification,
  "refresh-news": ScheduledJobType.refreshNews,
  "sync-calendar": ScheduledJobType.syncCalendar,
  "scan-due-timers": ScheduledJobType.scanDueTimers,
  "scan-routine-reminders": ScheduledJobType.scanRoutineReminders,
  "purge-revoked-push": ScheduledJobType.purgeRevokedPush,
  "renew-calendar-watch": ScheduledJobType.renewCalendarWatch,
  "scheduler-lock": ScheduledJobType.schedulerLock,
  "worker-heartbeat": ScheduledJobType.workerHeartbeat,
  "purge-expired": ScheduledJobType.purgeExpired
} as const satisfies Record<JobType, (typeof ScheduledJobType)[keyof typeof ScheduledJobType]>;

export function toTimeFormat(
  value: DomainTimeFormat
): (typeof TimeFormat)[keyof typeof TimeFormat] {
  return value === "12" ? TimeFormat.hour12 : TimeFormat.hour24;
}

export function fromTimeFormat(
  value: (typeof TimeFormat)[keyof typeof TimeFormat]
): DomainTimeFormat {
  return value === TimeFormat.hour12 ? "12" : "24";
}

export function toTimerPhase(
  value: DomainTimerPhase
): (typeof TimerPhase)[keyof typeof TimerPhase] {
  if (value === "short-break") {
    return TimerPhase.shortBreak;
  }

  if (value === "long-break") {
    return TimerPhase.longBreak;
  }

  return TimerPhase.work;
}

export function fromTimerPhase(
  value: (typeof TimerPhase)[keyof typeof TimerPhase]
): DomainTimerPhase {
  if (value === TimerPhase.shortBreak) {
    return "short-break";
  }

  if (value === TimerPhase.longBreak) {
    return "long-break";
  }

  return "work";
}

export function toJobType(
  value: JobType
): (typeof ScheduledJobType)[keyof typeof ScheduledJobType] {
  return JOB_TO_PRISMA[value];
}

export function fromJobType(value: string): JobType | null {
  for (const [domain, stored] of Object.entries(JOB_TO_PRISMA)) {
    if (stored === value || domain === value) {
      return domain as JobType;
    }
  }

  return null;
}
