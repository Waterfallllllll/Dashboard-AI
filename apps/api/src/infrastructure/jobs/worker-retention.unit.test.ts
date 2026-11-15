import { describe, expect, it } from "vitest";

import { MemoryJobQueue } from "./memory-job-queue.js";
import { periodicJobs, runWorkerCycle, type WorkerHandlers } from "./worker-cycle.js";

const now = new Date("2026-11-15T10:20:00.000Z");
const hourMs = 60 * 60 * 1000;

describe("часовая очистка", () => {
  it("ставит одну задачу purge-expired на час", () => {
    const first = periodicJobs(now, 5).find((job) => job.type === "purge-expired");
    const sameHour = periodicJobs(new Date(now.getTime() + 30 * 60 * 1000), 5).find(
      (job) => job.type === "purge-expired"
    );
    const nextHour = periodicJobs(new Date(now.getTime() + hourMs), 5).find(
      (job) => job.type === "purge-expired"
    );
    const bucket = Math.floor(now.getTime() / hourMs);

    expect(first?.idempotencyKey).toBe(`schedule:purge-expired:${bucket}`);
    expect(first?.userId).toBeNull();
    expect(sameHour?.idempotencyKey).toBe(first?.idempotencyKey);
    expect(nextHour?.idempotencyKey).not.toBe(first?.idempotencyKey);
  });

  it("вызывает очистку и пишет в журнал только идентификатор задачи", async () => {
    const queue = new MemoryJobQueue();
    await queue.tryLock("scheduler", "holder", now, 10 * 60_000);
    await queue.schedule({
      type: "purge-expired",
      payload: { title: "секрет" },
      runAt: now,
      idempotencyKey: "purge:test:ready",
      userId: null,
      maxAttempts: 2
    });
    let purged = 0;
    const events: unknown[] = [];
    const result = await runWorkerCycle({
      jobs: queue,
      workerId: "worker-a",
      now,
      leaseMs: 30_000,
      retentionMs: 86_400_000,
      maxAttempts: 2,
      handlers: handlers(async () => {
        purged += 1;
      }),
      onJob: (event) => {
        events.push(event);
      }
    });

    expect(result).toBe("processed");
    expect(purged).toBe(1);
    expect(events).toEqual([
      expect.objectContaining({
        type: "purge-expired",
        attempt: 1,
        outcome: "done"
      })
    ]);
    expect(JSON.stringify(events)).not.toContain("секрет");
    expect((await queue.counts()).completed).toBe(1);
  });

  it("не помечает очистку успешной, если обработчик не подключён", async () => {
    const queue = new MemoryJobQueue();
    await queue.tryLock("scheduler", "holder", now, 10 * 60_000);
    await queue.schedule({
      type: "purge-expired",
      payload: {},
      runAt: now,
      idempotencyKey: "purge:test:unwired",
      userId: null,
      maxAttempts: 1
    });
    const wired = handlers(async () => undefined);
    const result = await runWorkerCycle({
      jobs: queue,
      workerId: "worker-a",
      now,
      leaseMs: 30_000,
      retentionMs: 86_400_000,
      maxAttempts: 1,
      handlers: {
        timerDue: wired.timerDue,
        deliver: wired.deliver,
        refreshNews: wired.refreshNews,
        syncCalendar: wired.syncCalendar,
        scanTimers: wired.scanTimers,
        scanRoutines: wired.scanRoutines,
        purgePush: wired.purgePush,
        renewWatches: wired.renewWatches
      }
    });

    expect(result).toBe("processed");
    expect((await queue.counts()).failed).toBe(1);
  });
});

function handlers(purgeExpired: () => Promise<void>): WorkerHandlers {
  return {
    timerDue: async () => ({ kind: "done" }),
    deliver: async () => ({ kind: "done" }),
    refreshNews: async () => undefined,
    syncCalendar: async () => undefined,
    scanTimers: async () => undefined,
    scanRoutines: async () => undefined,
    purgePush: async () => undefined,
    renewWatches: async () => undefined,
    purgeExpired
  };
}
