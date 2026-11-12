import { describe, expect, it } from "vitest";

import { widgetPreferencesPatchSchema, widgetPreferencesSchema } from "./preferences.js";

const updatedAt = "2026-11-11T12:00:00.000Z";

const widgets = [
  ["datetime", "compact", {}],
  ["weather", "wide", { refreshMinutes: 30, temperatureUnit: "celsius" }],
  ["calendar", "compact", { itemLimit: 5, refreshMinutes: 30, calendarScope: "all" }],
  ["routines", "standard", { itemLimit: 10 }],
  ["timer", "standard", { dailyGoal: 8, volume: 0.4 }],
  ["news", "standard", { itemLimit: 5, refreshMinutes: 30, newsSourceMode: "all" }]
] as const;

describe("настройки виджетов", () => {
  it("принимает полный набор и отклоняет лишнее поле", () => {
    const payload = {
      widgets: widgets.map(([widgetType, size, settings], position) => ({
        widgetType,
        enabled: true,
        position,
        size,
        settings,
        version: 1,
        updatedAt
      })),
      updatedAt
    };

    const patches = payload.widgets.map((widget) => ({
      widgetType: widget.widgetType,
      enabled: widget.enabled,
      position: widget.position,
      size: widget.size,
      settings: widget.settings,
      version: widget.version
    }));

    expect(widgetPreferencesSchema.parse(payload).widgets).toHaveLength(6);
    expect(widgetPreferencesPatchSchema.parse({ widgets: patches }).widgets).toHaveLength(6);
    expect(widgetPreferencesSchema.safeParse({ ...payload, userId: "secret" }).success).toBe(false);
    expect(widgetPreferencesPatchSchema.safeParse({ widgets: patches.slice(0, 5) }).success).toBe(
      false
    );
  });
});
