import { describe, expect, it } from "vitest";

import { MemoryJobQueue } from "./memory-job-queue.js";
import { runWorkerCycle } from "./worker-cycle.js";
import type { ScheduleJob } from "./job-types.js";

const now = new Date("2026-11-12T10:00:00.000Z");

function job(key: string, runAt = now): ScheduleJob {
  return {
    type: "refresh-news",
    payload: {},
    runAt,
    idempotencyKey: key,
    userId: null,
    maxAttempts: 2
  };
}

describe("очередь задач", () => {
  it("забирает самую раннюю задачу один раз", async () => {
    const queue = new MemoryJobQueue();
    await queue.schedule(job("job:first:ready", new Date(now.getTime() + 1000)));
    await queue.schedule(job("job:second:ready", now));
    const claimed = await queue.claim("worker-a", now, 30_000);
    const second = await queue.claim("worker-b", now, 30_000);

    expect(claimed?.idempotencyKey).toBe("job:second:ready");
    expect(second).toBeNull();
  });

  it("не создаёт вторую задачу с тем же ключом", async () => {
    const queue = new MemoryJobQueue();
    await queue.schedule(job("job:same:key1"));
    const again = await queue.schedule(job("job:same:key1", new Date(now.getTime() + 5000)));

    expect(again).toBe("updated");
    expect((await queue.counts()).pending).toBe(1);
  });

  it("возвращает просроченную аренду и исчерпывает попытки", async () => {
    const queue = new MemoryJobQueue();
    await queue.schedule(job("job:retry:key1"));
    const first = await queue.claim("worker-a", now, 1000);
    await queue.releaseExpired(new Date(now.getTime() + 1001));
    const second = await queue.claim("worker-a", new Date(now.getTime() + 1001), 1000);

    expect(first?.attempts).toBe(1);
    expect(second?.attempts).toBe(2);
    await queue.retry(
      second!.id,
      "worker-a",
      new Date(now.getTime() + 1001),
      new Date(now.getTime() + 2000),
      "temporary",
      new Date(now.getTime() + 10_000)
    );
    expect((await queue.counts()).failed).toBe(1);
  });

  it("перенос срока не сжигает попытку", async () => {
    const queue = new MemoryJobQueue();
    await queue.schedule(job("job:later:key1"));
    const claimed = await queue.claim("worker-a", now, 30_000);
    await queue.reschedule(claimed!.id, "worker-a", new Date(now.getTime() + 60_000), now);
    const tooEarly = await queue.claim("worker-a", now, 30_000);
    const later = await queue.claim("worker-a", new Date(now.getTime() + 60_000), 30_000);

    expect(tooEarly).toBeNull();
    expect(later?.attempts).toBe(1);
  });
});

describe("цикл worker", () => {
  it("обрабатывает одну задачу и повторяет временную ошибку", async () => {
    const queue = new MemoryJobQueue();
    await queue.tryLock("scheduler", "holder", now, 10 * 60_000);
    await queue.schedule(job("job:cycle:key1"));
    let calls = 0;
    const handlers = {
      timerDue: async () => ({ kind: "done" as const }),
      deliver: async () => ({ kind: "done" as const }),
      refreshNews: async () => {
        calls += 1;

        if (calls === 1) {
          throw new Error("temporary");
        }
      },
      syncCalendar: async () => undefined,
      scanTimers: async () => undefined,
      scanRoutines: async () => undefined,
      purgePush: async () => undefined,
      renewWatches: async () => undefined
    };
    const first = await runWorkerCycle({
      jobs: queue,
      workerId: "worker-a",
      now,
      leaseMs: 30_000,
      retentionMs: 86_400_000,
      maxAttempts: 2,
      handlers
    });
    expect(first).toBe("processed");
    expect(calls).toBe(1);
    expect((await queue.counts()).pending).toBe(1);
    const second = await runWorkerCycle({
      jobs: queue,
      workerId: "worker-a",
      now: new Date(now.getTime() + 5000),
      leaseMs: 30_000,
      retentionMs: 86_400_000,
      maxAttempts: 2,
      handlers
    });
    expect(second).toBe("processed");
    expect(calls).toBe(2);
    expect((await queue.counts()).completed).toBeGreaterThan(0);
  });
});
