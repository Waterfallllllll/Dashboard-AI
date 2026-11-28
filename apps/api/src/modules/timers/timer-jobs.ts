import type { ScheduleJob } from "../../infrastructure/jobs/job-types.js";
import type { JobQueue } from "../../infrastructure/jobs/memory-job-queue.js";
import type { TimerRecord } from "./timers.types.js";

export type JobScheduler = Pick<JobQueue, "schedule">;

const CHANNELS = ["browser", "telegram", "in_app"] as const;

export async function followTimer(
  jobs: JobScheduler,
  session: TimerRecord,
  maxAttempts: number
): Promise<void> {
  if (session.runStatus === "running" && session.endsAt && !session.completedAt) {
    await jobs.schedule(timerDueJob(session, session.endsAt, maxAttempts));
    return;
  }

  if (
    session.completedAt &&
    session.endsAt &&
    session.completedAt.getTime() >= session.endsAt.getTime()
  ) {
    const eventType = session.phase === "work" ? "work" : "break";

    for (const channel of CHANNELS) {
      await jobs.schedule({
        type: "deliver-notification",
        payload: { eventType, channel, sessionId: session.id, phase: session.phase },
        runAt: session.completedAt,
        idempotencyKey: `timer:${session.id}:${session.phase}:completed:${channel}`,
        userId: session.userId,
        maxAttempts
      });
    }
  }
}

export function timerDueJob(session: TimerRecord, runAt: Date, maxAttempts: number): ScheduleJob {
  return {
    type: "timer-due",
    payload: { sessionId: session.id },
    runAt,
    idempotencyKey: `timer:${session.id}:due:${runAt.getTime()}`,
    userId: session.userId,
    maxAttempts
  };
}
