import { describe, expect, it } from "vitest";

import { API_ERROR_CODES, type WidgetPreference } from "@dashboard/contracts";

import { MemoryWidgetsRepository } from "../personal-memory.js";
import type { WidgetsRepository } from "./widgets.repository.js";
import { WidgetsService } from "./widgets.service.js";
import type { DashboardConfigRecord } from "./widgets.types.js";

const now = new Date("2026-11-11T12:00:00.000Z");
const owner = "a".repeat(24);
const actor = { userId: owner, sessionId: "session" };

function withoutUpdatedAt(widget: WidgetPreference) {
  return {
    widgetType: widget.widgetType,
    enabled: widget.enabled,
    position: widget.position,
    size: widget.size,
    settings: widget.settings,
    version: widget.version
  };
}

describe("настройки виджетов", () => {
  it("создаёт порядок по умолчанию и отклоняет устаревшую версию", async () => {
    const service = new WidgetsService(new MemoryWidgetsRepository(), () => now);
    const created = await service.get(actor);
    expect(created.widgets.map((widget) => widget.widgetType)).toEqual([
      "datetime",
      "weather",
      "calendar",
      "routines",
      "timer",
      "news"
    ]);

    const moved = created.widgets.map((widget, index) =>
      index === 0
        ? { ...widget, position: 1, version: widget.version }
        : index === 1
          ? { ...widget, position: 0 }
          : widget
    );
    const saved = await service.update(actor, {
      widgets: moved.map(withoutUpdatedAt)
    });
    expect(saved.widgets.find((widget) => widget.widgetType === "weather")?.position).toBe(0);
    expect(saved.widgets[0]?.version).toBe(2);

    await expect(
      service.update(actor, {
        widgets: moved.map(withoutUpdatedAt)
      })
    ).rejects.toMatchObject({ code: API_ERROR_CODES.conflict });
  });

  it("не отдаёт чужой документ настроек", async () => {
    const foreign: DashboardConfigRecord = {
      userId: "b".repeat(24),
      updatedAt: now,
      widgets: []
    };
    const repository: WidgetsRepository = {
      async findByUser() {
        return foreign;
      },
      async insert() {
        return "inserted";
      },
      async replace() {
        return foreign;
      }
    };

    await expect(new WidgetsService(repository, () => now).get(actor)).rejects.toMatchObject({
      code: API_ERROR_CODES.notFound
    });
  });
});
