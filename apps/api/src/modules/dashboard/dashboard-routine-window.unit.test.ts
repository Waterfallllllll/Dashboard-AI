import { dashboardSchema } from "@dashboard/contracts";
import { describe, expect, it } from "vitest";

import {
  MemoryRoutinesRepository,
  MemoryTimersRepository,
  MemoryWidgetsRepository
} from "../personal-memory.js";
import { createPersonalServices } from "../personal-services.js";

const viewer = {
  userId: "a".repeat(24),
  sessionId: "session",
  timezone: "Europe/Moscow",
  timeFormat: "24" as const
};

describe("окно рутин на дашборде", () => {
  it("показывает бесконечную ежедневную рутину на завтра и прячет закончившуюся", async () => {
    const { dashboard, routines } = createPersonalServices(
      {
        widgets: new MemoryWidgetsRepository(),
        routines: new MemoryRoutinesRepository(),
        timers: new MemoryTimersRepository()
      },
      { now: () => new Date("2026-11-27T07:00:00.000Z") }
    );
    await routines.create(
      viewer,
      { title: "Front-End", startDate: "2026-11-27", recurrence: { kind: "daily" } },
      viewer.timezone,
      null
    );
    await routines.create(
      viewer,
      {
        title: "Короткое",
        startDate: "2026-11-27",
        endDate: "2026-11-27",
        recurrence: { kind: "daily" }
      },
      viewer.timezone,
      null
    );

    const parsed = dashboardSchema.parse(await dashboard.load(viewer, "2026-11-27"));

    if (parsed.routines.status !== "ready" || !parsed.routines.days) {
      throw new Error("Окно рутин не собрано");
    }

    const [yesterday, today, tomorrow] = parsed.routines.days;
    expect(yesterday?.date).toBe("2026-11-26");
    expect(yesterday?.items).toEqual([]);
    expect(today?.items.map((item) => item.title).sort()).toEqual(["Front-End", "Короткое"]);
    expect(tomorrow?.date).toBe("2026-11-28");
    expect(tomorrow?.items.map((item) => item.title)).toEqual(["Front-End"]);
  });
});
