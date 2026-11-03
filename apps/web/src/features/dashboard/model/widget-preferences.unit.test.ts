import { describe, expect, it } from "vitest";

import { DEFAULT_WIDGET_LAYOUT } from "./widget-catalog";
import {
  allowedSizesForWidget,
  createDefaultPreferences,
  moveWidget,
  normalizeWidgetPreferences,
  parseStoredWidgetPreferences,
  setWidgetSize,
  toggleWidget,
  toWidgetPlacements
} from "./widget-preferences";

describe("widget preferences", () => {
  it("сохраняет порядок и размеры по умолчанию без пустых промежутков", () => {
    const preferences = createDefaultPreferences();

    expect(preferences.map((widget) => widget.type)).toEqual(
      DEFAULT_WIDGET_LAYOUT.map((widget) => widget.type)
    );
    expect(toWidgetPlacements(preferences)).toEqual(DEFAULT_WIDGET_LAYOUT);
    expect(normalizeWidgetPreferences(preferences)).toBe(preferences);
  });

  it("разрешает в первой строке только размеры, кратные трём колонкам", () => {
    const preferences = createDefaultPreferences();

    expect(allowedSizesForWidget(preferences, "weather")).toEqual(["compact", "wide"]);
    expect(allowedSizesForWidget(preferences, "calendar")).toEqual(["compact", "standard", "wide"]);
    expect(setWidgetSize(preferences, "weather", "standard")).toBe(preferences);
  });

  it("поджимает размер, если перенос оставил бы пустой промежуток", () => {
    const moved = moveWidget(createDefaultPreferences(), "calendar", -1);

    expect(moved.map((widget) => `${widget.type}:${widget.size}`)).toEqual([
      "datetime:compact",
      "weather:wide",
      "calendar:compact",
      "timer:compact",
      "routines:wide",
      "news:compact"
    ]);
  });

  it("выключает виджет и пересобирает строку без дыр", () => {
    const hidden = toggleWidget(createDefaultPreferences(), "weather", false);

    expect(hidden.find((widget) => widget.type === "weather")?.enabled).toBe(false);
    expect(
      toWidgetPlacements(hidden)
        .filter((widget) => widget.enabled)
        .map((widget) => widget.type)
    ).toEqual(["datetime", "timer", "calendar", "routines", "news"]);
    expect(hidden.find((widget) => widget.type === "calendar")?.size).toBe("wide");
  });

  it("отбрасывает повреждённые настройки и дополняет недостающие виджеты", () => {
    const parsed = parseStoredWidgetPreferences(
      JSON.stringify([
        {
          type: "news",
          enabled: false,
          size: "compact",
          position: 0,
          itemLimit: 3,
          refreshMinutes: 15,
          temperatureUnit: "fahrenheit",
          newsSourceMode: "official",
          calendarScope: "work"
        },
        { type: "weather", size: "full" }
      ])
    );

    expect(parsed?.find((widget) => widget.type === "news")).toMatchObject({
      enabled: false,
      size: "compact",
      itemLimit: 3,
      newsSourceMode: "official"
    });
    expect(parsed?.find((widget) => widget.type === "datetime")?.enabled).toBe(true);
    expect(
      parsed?.some(
        (widget) =>
          widget.size === "wide" || widget.size === "standard" || widget.size === "compact"
      )
    ).toBe(true);
  });

  it("не принимает пустое или битое хранилище", () => {
    expect(parseStoredWidgetPreferences(null)).toBeNull();
    expect(parseStoredWidgetPreferences("{")).toBeNull();
    expect(parseStoredWidgetPreferences("[]")).toBeNull();
  });
});
