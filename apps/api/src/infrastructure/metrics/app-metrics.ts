import { Gauge, Registry } from "@prometheus-io/client";

import type { JobQueue } from "../jobs/memory-job-queue.js";

export type DeliveryCount = {
  readonly channel: string;
  readonly status: string;
  readonly count: number;
};

export type MetricsSource = {
  text(): Promise<string>;
  contentType: string;
};

export function createMetrics(
  jobs: JobQueue,
  deliveryCounts: () => Promise<readonly DeliveryCount[]>
): MetricsSource {
  const registry = new Registry();
  const queueJobs = new Gauge({
    name: "dashboard_queue_jobs",
    help: "Число задач очереди по статусу",
    labelNames: ["status"],
    registers: [registry]
  });
  const oldestPending = new Gauge({
    name: "dashboard_queue_oldest_pending_seconds",
    help: "Возраст самой старой ожидающей задачи",
    registers: [registry]
  });
  const heartbeatAge = new Gauge({
    name: "dashboard_worker_heartbeat_age_seconds",
    help: "Сколько секунд прошло с последнего heartbeat worker",
    registers: [registry]
  });
  const deliveries = new Gauge({
    name: "dashboard_notification_deliveries",
    help: "Журнал доставки по каналу и статусу",
    labelNames: ["channel", "status"],
    registers: [registry]
  });

  return {
    contentType: registry.contentType,
    async text() {
      const now = Date.now();
      const [counts, oldest, beat, recent] = await Promise.all([
        jobs.counts(),
        jobs.oldestPendingRunAt(),
        jobs.latestHeartbeatAt(),
        deliveryCounts()
      ]);
      queueJobs.reset();

      for (const [status, count] of Object.entries(counts)) {
        queueJobs.set({ status }, count);
      }

      oldestPending.set(oldest ? Math.max(0, (now - oldest.getTime()) / 1000) : 0);
      heartbeatAge.set(beat ? Math.max(0, (now - beat.getTime()) / 1000) : -1);
      deliveries.reset();

      for (const row of recent) {
        deliveries.set({ channel: row.channel, status: row.status }, row.count);
      }

      return registry.metrics();
    }
  };
}
