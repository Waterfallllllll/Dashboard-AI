import { describe, expect, it } from "vitest";

import { DEFAULT_WIDGET_LAYOUT } from "./widget-catalog";
import {
  getColumnSpan,
  getGridColumnCount,
  getVisibleWidgets,
  isDashboardEmpty
} from "./widget-layout";

describe("widget layout", () => {
  it("возвращает включённые виджеты в порядке позиции", () => {
    const visible = getVisibleWidgets([
      { type: "news", size: "standard", enabled: true, position: 5, hasExternalSource: true },
      { type: "datetime", size: "compact", enabled: false, position: 0, hasExternalSource: false },
      { type: "weather", size: "wide", enabled: true, position: 1, hasExternalSource: true }
    ]);

    expect(visible.map((widget) => widget.type)).toEqual(["weather", "news"]);
  });

  it("считает дашборд пустым, если все виджеты выключены", () => {
    expect(
      isDashboardEmpty(
        DEFAULT_WIDGET_LAYOUT.map((widget) => ({
          ...widget,
          enabled: false
        }))
      )
    ).toBe(true);
  });

  it("выбирает 1, 6 или 12 колонок по ширине контейнера", () => {
    expect(getGridColumnCount(320)).toBe(1);
    expect(getGridColumnCount(576)).toBe(6);
    expect(getGridColumnCount(895)).toBe(6);
    expect(getGridColumnCount(896)).toBe(12);
  });

  it("считает span без разрывов для рекомендованной раскладки", () => {
    expect(
      getColumnSpan("compact", 12) + getColumnSpan("wide", 12) + getColumnSpan("compact", 12)
    ).toBe(12);
    expect(
      getColumnSpan("standard", 12) + getColumnSpan("standard", 12) + getColumnSpan("standard", 12)
    ).toBe(12);
    expect(getColumnSpan("compact", 6)).toBe(3);
    expect(getColumnSpan("wide", 6)).toBe(6);
    expect(getColumnSpan("standard", 1)).toBe(1);
  });
});
