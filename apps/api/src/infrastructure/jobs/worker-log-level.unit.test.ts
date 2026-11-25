import { describe, expect, it } from "vitest";

import { workerJobLogLevel } from "./worker-log-level.js";

describe("уровень журнала worker", () => {
  it("прячет успешный плановый опрос", () => {
    expect(workerJobLogLevel({ type: "scan-due-timers", outcome: "done" })).toBe("debug");
    expect(workerJobLogLevel({ type: "scan-routine-reminders", outcome: "done" })).toBe("debug");
  });

  it("оставляет полезную работу на info", () => {
    expect(workerJobLogLevel({ type: "timer-due", outcome: "done" })).toBe("info");
    expect(workerJobLogLevel({ type: "deliver-notification", outcome: "done" })).toBe("info");
    expect(workerJobLogLevel({ type: "refresh-news", outcome: "done" })).toBe("info");
    expect(workerJobLogLevel({ type: "sync-calendar", outcome: "done" })).toBe("info");
    expect(workerJobLogLevel({ type: "scan-due-timers", outcome: "reschedule" })).toBe("info");
  });

  it("поднимает повтор и отказ до warn", () => {
    expect(workerJobLogLevel({ type: "scan-due-timers", outcome: "retry" })).toBe("warn");
    expect(workerJobLogLevel({ type: "deliver-notification", outcome: "fail" })).toBe("warn");
  });
});
