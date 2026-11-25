import type { WorkerJobEvent } from "./worker-cycle.js";

const QUIET_WHEN_DONE = new Set<WorkerJobEvent["type"]>([
  "scan-due-timers",
  "scan-routine-reminders"
]);

export type WorkerLogLevel = "debug" | "info" | "warn";

export function workerJobLogLevel(
  event: Pick<WorkerJobEvent, "type" | "outcome">
): WorkerLogLevel {
  if (event.outcome === "retry" || event.outcome === "fail") {
    return "warn";
  }

  if (event.outcome === "done" && QUIET_WHEN_DONE.has(event.type)) {
    return "debug";
  }

  return "info";
}
