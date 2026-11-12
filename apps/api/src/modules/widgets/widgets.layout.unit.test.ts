import { describe, expect, it } from "vitest";

import type { WidgetPreferencePatch } from "@dashboard/contracts";

import { DEFAULT_WIDGET_ORDER, layoutFieldErrors } from "./widgets.layout.js";

function layout(
  sizes: Readonly<Record<string, WidgetPreferencePatch["size"]>>,
  disabled: readonly string[] = []
): WidgetPreferencePatch[] {
  return DEFAULT_WIDGET_ORDER.map((widget, position) => ({
    widgetType: widget.widgetType,
    enabled: !disabled.includes(widget.widgetType),
    position,
    size: sizes[widget.widgetType] ?? widget.size,
    settings:
      widget.widgetType === "timer"
        ? { dailyGoal: 8 }
        : widget.widgetType === "weather"
          ? { temperatureUnit: "celsius" }
          : {},
    version: 1
  }));
}

describe("сетка виджетов", () => {
  it("принимает порядок по умолчанию и отклоняет дыру в ряду", () => {
    expect(layoutFieldErrors(layout({}))).toBeNull();
    expect(
      layoutFieldErrors(
        layout({
          datetime: "standard",
          weather: "wide"
        })
      )?.weather
    ).toEqual(["Размер виджета оставляет пустой промежуток в сетке."]);
  });

  it("не даёт погодному виджету цель таймера и повторяет тип", () => {
    const widgets = layout({});
    const weather = widgets[1];

    if (!weather) {
      throw new Error("Нет виджета погоды");
    }

    const withGoal = widgets.map((widget) =>
      widget.widgetType === "weather" ? { ...widget, settings: { dailyGoal: 4 } } : widget
    );
    expect(layoutFieldErrors(withGoal)?.weather).toEqual(["Эта настройка не относится к виджету."]);

    const duplicated = widgets.map((widget, index) =>
      index === 2 ? { ...widget, widgetType: "weather" as const } : widget
    );
    expect(layoutFieldErrors(duplicated)?.widgets).toEqual(["Каждый виджет указывается один раз."]);
  });
});
