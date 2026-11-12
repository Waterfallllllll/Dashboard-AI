import { describe, expect, it } from "vitest";

import { SECTION_ERROR_MESSAGE } from "@dashboard/contracts";

import {
  MemoryRoutinesRepository,
  MemoryTimersRepository,
  MemoryWidgetsRepository
} from "../personal-memory.js";
import { createPersonalServices } from "../personal-services.js";
import type { ExternalSectionSource } from "./dashboard.service.js";

const viewer = {
  userId: "a".repeat(24),
  sessionId: "session",
  timezone: "Europe/Moscow",
  timeFormat: "24" as const
};

describe("агрегированный дашборд", () => {
  it("оставляет остальные секции готовыми, если погода упала", async () => {
    const weather: ExternalSectionSource = {
      async load() {
        throw new Error("provider down secret-token");
      }
    };
    const { dashboard, routines } = createPersonalServices(
      {
        widgets: new MemoryWidgetsRepository(),
        routines: new MemoryRoutinesRepository(),
        timers: new MemoryTimersRepository()
      },
      { now: () => new Date("2026-11-11T09:00:00.000Z"), weather }
    );
    await routines.create(
      viewer,
      { title: "Зарядка", startDate: "2026-11-11", recurrence: { kind: "once" } },
      viewer.timezone,
      null
    );

    const payload = await dashboard.load(viewer, "2026-11-11");
    expect(payload.weather).toEqual({ status: "error", message: SECTION_ERROR_MESSAGE });
    expect(payload.calendar).toEqual({ status: "unavailable" });
    expect(payload.news).toEqual({ status: "unavailable" });
    expect(payload.routines.status).toBe("ready");
    expect(payload.widgets.status).toBe("ready");
    expect(payload.timer.status).toBe("ready");
    expect(payload.datetime.status).toBe("ready");
    expect(JSON.stringify(payload)).not.toContain("provider down");
    expect(JSON.stringify(payload)).not.toContain("secret-token");

    if (payload.routines.status === "ready") {
      expect(payload.routines.day.items).toHaveLength(1);
    }
  });
});
