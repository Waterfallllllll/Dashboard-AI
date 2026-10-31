import { DEFAULT_WIDGET_LAYOUT } from "./widget-catalog";
import type { WidgetPlacement, WidgetSize } from "./widget-catalog";

export { DEFAULT_WIDGET_LAYOUT, WIDGET_TITLES } from "./widget-catalog";
export type { WidgetPlacement, WidgetSize, WidgetType } from "./widget-catalog";

export type GridColumnCount = 1 | 6 | 12;

export const TABLET_GRID_MIN_INLINE_SIZE = 576;
export const DESKTOP_GRID_MIN_INLINE_SIZE = 896;

export function getVisibleWidgets(
  layout: readonly WidgetPlacement[] = DEFAULT_WIDGET_LAYOUT
): WidgetPlacement[] {
  return layout
    .filter((widget) => widget.enabled)
    .sort((left, right) => left.position - right.position);
}

export function isDashboardEmpty(
  layout: readonly WidgetPlacement[] = DEFAULT_WIDGET_LAYOUT
): boolean {
  return getVisibleWidgets(layout).length === 0;
}

export function getGridColumnCount(inlineSizePx: number): GridColumnCount {
  if (inlineSizePx >= DESKTOP_GRID_MIN_INLINE_SIZE) {
    return 12;
  }

  if (inlineSizePx >= TABLET_GRID_MIN_INLINE_SIZE) {
    return 6;
  }

  return 1;
}

export function getColumnSpan(size: WidgetSize, columns: GridColumnCount): number {
  if (columns === 1) {
    return 1;
  }

  if (columns === 6) {
    return size === "compact" ? 3 : 6;
  }

  switch (size) {
    case "compact":
      return 3;
    case "standard":
      return 4;
    case "wide":
      return 6;
    case "full":
      return 12;
  }
}
