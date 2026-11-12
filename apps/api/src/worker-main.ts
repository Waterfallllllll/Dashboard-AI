import "dotenv/config";

import { ApiError } from "./shared/errors/api-error.js";
import { createBackend } from "./app/create-backend.js";
import { runWorkerCycle } from "./infrastructure/jobs/worker-cycle.js";
import { ProviderUnavailableError } from "./infrastructure/http/provider-guard.js";
import { localDateInTimeZone } from "./shared/local-date.js";
import { notificationDeleteAt } from "./infrastructure/mongodb/retention.js";

try {
  const backend = await createBackend();
  const workerId = backend.runtime.worker.id;
  let stopped = false;
  const stop = () => {
    stopped = true;
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
  backend.logger.info({ workerId }, "Worker запущен");

  while (!stopped) {
    const started = Date.now();

    try {
      const result = await runWorkerCycle({
        jobs: backend.jobs,
        workerId,
        now: new Date(),
        leaseMs: backend.runtime.worker.leaseMs,
        retentionMs: notificationDeleteAt(
          new Date(0),
          backend.runtime.worker.retentionDays
        ).getTime(),
        maxAttempts: backend.runtime.worker.maxAttempts,
        handlers: {
          timerDue: (userId, sessionId) => backend.personal.timers.handleDue(userId, sessionId),
          deliver: (job) => backend.notificationsService.deliver(job),
          refreshNews: () => backend.external.news.refresh(),
          syncCalendar: async (userId) => {
            if (!userId) {
              const ids = await backend.external.integrations.connectedCalendarUserIds(20);
              const bucket = Math.floor(Date.now() / (30 * 60_000));

              for (const id of ids) {
                await backend.jobs.schedule({
                  type: "sync-calendar",
                  payload: {},
                  runAt: new Date(),
                  idempotencyKey: `calendar-sync:${id}:${bucket}`,
                  userId: id,
                  maxAttempts: backend.runtime.worker.maxAttempts
                });
              }

              return;
            }

            const profile = await backend.usersService.getProfile({
              userId,
              sessionId: "worker"
            });
            const today = localDateInTimeZone(new Date(), profile.timezone);
            try {
              await backend.external.calendar.sync(
                {
                  userId,
                  sessionId: "worker",
                  timezone: profile.timezone,
                  timeFormat: profile.timeFormat
                },
                today
              );
              await backend.external.calendar.enqueueUpcomingReminders(
                userId,
                profile.timezone,
                backend.jobs,
                backend.runtime.worker.maxAttempts
              );
            } catch (error) {
              if (error instanceof ApiError) {
                return;
              }

              throw error;
            }
          },
          scanTimers: () => backend.personal.timers.scanDue(50),
          scanRoutines: () =>
            backend.personal.routines.enqueueDueReminders(
              backend.jobs,
              backend.runtime.worker.maxAttempts
            ),
          purgePush: () => backend.notificationsService.purgeRevoked(),
          renewWatches: () => backend.renewWatches()
        }
      });
      backend.logger.info({ workerId, result, durationMs: Date.now() - started }, "Цикл worker");
    } catch (error) {
      const code = error instanceof ProviderUnavailableError ? error.provider : "unexpected";
      backend.logger.error(
        { workerId, code, durationMs: Date.now() - started },
        "Цикл worker не завершился"
      );
    }

    await delay(backend.runtime.worker.pollIntervalMs, () => stopped);
  }

  await backend.close();
} catch (error) {
  const message = error instanceof Error ? error.message : "Worker не запустился";
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function delay(ms: number, isStopped: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      clearInterval(probe);
      resolve();
    };
    const timer = setTimeout(finish, ms);
    const probe = setInterval(() => {
      if (isStopped()) {
        finish();
      }
    }, 200);
    timer.unref?.();
  });
}
