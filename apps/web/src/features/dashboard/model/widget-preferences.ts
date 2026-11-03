import {
  DEFAULT_WIDGET_LAYOUT,
  WIDGET_TYPES,
  type WidgetPlacement,
  type WidgetSize,
  type WidgetType
} from "./widget-catalog";

export const EDITOR_SIZES = ["compact", "standard", "wide"] as const;
export const ITEM_LIMITS = [3, 4, 5, 6, 8, 10] as const;
export const REFRESH_MINUTES = [15, 30, 60] as const;

export type EditorSize = (typeof EDITOR_SIZES)[number];
export type ItemLimit = (typeof ITEM_LIMITS)[number];
export type RefreshMinutes = (typeof REFRESH_MINUTES)[number];
export type TemperatureUnit = "celsius" | "fahrenheit";
export type NewsSourceMode = "all" | "official";
export type CalendarScope = "all" | "work";

export type WidgetPreference = Readonly<{
  type: WidgetType;
  enabled: boolean;
  size: EditorSize;
  position: number;
  itemLimit: ItemLimit;
  refreshMinutes: RefreshMinutes;
  temperatureUnit: TemperatureUnit;
  newsSourceMode: NewsSourceMode;
  calendarScope: CalendarScope;
}>;

export const WIDGET_SUMMARIES: Readonly<Record<WidgetType, string>> = {
  datetime: "Часы, дата и выбранный часовой пояс.",
  weather: "Текущая погода и короткий почасовой прогноз.",
  calendar: "События на сегодня из подключённых календарей.",
  routines: "Дела на вчера, сегодня и завтра.",
  timer: "Рабочие интервалы и перерывы.",
  news: "Короткая лента материалов по выбранным источникам."
};

export const WIDGET_PREFERENCES_STORAGE_KEY = "evergreen-widget-preferences";
export const WIDGET_SAVE_DELAY_MS = 400;

const DESKTOP_COLUMNS = 12;
const SIZE_SPAN: Readonly<Record<EditorSize, number>> = {
  compact: 3,
  standard: 4,
  wide: 6
};

const DEFAULT_ITEM_LIMIT: ItemLimit = 10;
const DEFAULT_REFRESH_MINUTES: RefreshMinutes = 30;

export function createDefaultPreferences(): readonly WidgetPreference[] {
  return DEFAULT_WIDGET_LAYOUT.map((widget) => ({
    type: widget.type,
    enabled: widget.enabled,
    size: toEditorSize(widget.size),
    position: widget.position,
    itemLimit: DEFAULT_ITEM_LIMIT,
    refreshMinutes: DEFAULT_REFRESH_MINUTES,
    temperatureUnit: "celsius",
    newsSourceMode: "all",
    calendarScope: "all"
  }));
}

export function allowedEditorSizes(
  previousEnabledSizes: readonly EditorSize[]
): readonly EditorSize[] {
  const { mode, remaining } = packRow(previousEnabledSizes);

  if (mode === "open") {
    return EDITOR_SIZES;
  }

  if (mode === "quarters") {
    return remaining >= SIZE_SPAN.standard ? ["standard"] : EDITOR_SIZES;
  }

  const sizes: EditorSize[] = [];

  if (remaining >= SIZE_SPAN.compact) {
    sizes.push("compact");
  }

  if (remaining >= SIZE_SPAN.wide) {
    sizes.push("wide");
  }

  return sizes.length > 0 ? sizes : EDITOR_SIZES;
}

export function normalizeWidgetPreferences(
  preferences: readonly WidgetPreference[]
): readonly WidgetPreference[] {
  const next: WidgetPreference[] = [];
  const previousSizes: EditorSize[] = [];

  for (const widget of preferences) {
    if (!widget.enabled) {
      next.push(widget);
      continue;
    }

    const size = snapSize(widget.size, allowedEditorSizes(previousSizes));
    next.push(size === widget.size ? widget : { ...widget, size });
    previousSizes.push(size);
  }

  const normalized = reindex(next);

  if (
    normalized.length === preferences.length &&
    normalized.every((widget, index) => widget === preferences[index])
  ) {
    return preferences;
  }

  return normalized;
}

export function moveWidget(
  preferences: readonly WidgetPreference[],
  type: WidgetType,
  direction: -1 | 1
): readonly WidgetPreference[] {
  const sorted = [...preferences].sort((left, right) => left.position - right.position);
  const index = sorted.findIndex((widget) => widget.type === type);
  const target = index + direction;
  const moving = sorted[index];
  const displaced = sorted[target];

  if (!moving || !displaced || target < 0 || target >= sorted.length) {
    return preferences;
  }

  const next = sorted.slice();
  next[index] = displaced;
  next[target] = moving;
  return normalizeWidgetPreferences(next);
}

export function reorderWidgets(
  preferences: readonly WidgetPreference[],
  activeType: WidgetType,
  overType: WidgetType
): readonly WidgetPreference[] {
  if (activeType === overType) {
    return preferences;
  }

  const sorted = [...preferences].sort((left, right) => left.position - right.position);
  const from = sorted.findIndex((widget) => widget.type === activeType);
  const to = sorted.findIndex((widget) => widget.type === overType);
  const moving = sorted[from];

  if (!moving || from < 0 || to < 0) {
    return preferences;
  }

  const next = sorted.slice();
  next.splice(from, 1);
  next.splice(to, 0, moving);
  return normalizeWidgetPreferences(next);
}

export function toggleWidget(
  preferences: readonly WidgetPreference[],
  type: WidgetType,
  enabled: boolean
): readonly WidgetPreference[] {
  return normalizeWidgetPreferences(
    preferences.map((widget) => (widget.type === type ? { ...widget, enabled } : widget))
  );
}

export function setWidgetSize(
  preferences: readonly WidgetPreference[],
  type: WidgetType,
  size: EditorSize
): readonly WidgetPreference[] {
  const sorted = [...preferences].sort((left, right) => left.position - right.position);
  const previousSizes: EditorSize[] = [];

  for (const widget of sorted) {
    if (widget.type === type) {
      if (!widget.enabled || !allowedEditorSizes(previousSizes).includes(size)) {
        return preferences;
      }

      break;
    }

    if (widget.enabled) {
      previousSizes.push(widget.size);
    }
  }

  return normalizeWidgetPreferences(
    preferences.map((widget) => (widget.type === type ? { ...widget, size } : widget))
  );
}

export function setWidgetOption<Key extends OptionKey>(
  preferences: readonly WidgetPreference[],
  type: WidgetType,
  key: Key,
  value: WidgetPreference[Key]
): readonly WidgetPreference[] {
  return preferences.map((widget) => (widget.type === type ? { ...widget, [key]: value } : widget));
}

export function allowedSizesForWidget(
  preferences: readonly WidgetPreference[],
  type: WidgetType
): readonly EditorSize[] {
  const sorted = [...preferences].sort((left, right) => left.position - right.position);
  const previousSizes: EditorSize[] = [];

  for (const widget of sorted) {
    if (widget.type === type) {
      return allowedEditorSizes(previousSizes);
    }

    if (widget.enabled) {
      previousSizes.push(widget.size);
    }
  }

  return EDITOR_SIZES;
}

export function toWidgetPlacements(preferences: readonly WidgetPreference[]): WidgetPlacement[] {
  const externalSources = new Map(
    DEFAULT_WIDGET_LAYOUT.map((widget) => [widget.type, widget.hasExternalSource] as const)
  );

  return [...preferences]
    .sort((left, right) => left.position - right.position)
    .map((widget) => ({
      type: widget.type,
      size: widget.size,
      enabled: widget.enabled,
      position: widget.position,
      hasExternalSource: externalSources.get(widget.type) ?? false
    }));
}

export function parseStoredWidgetPreferences(
  rawValue: string | null
): readonly WidgetPreference[] | null {
  if (!rawValue) {
    return null;
  }

  try {
    const parsedValue: unknown = JSON.parse(rawValue);

    if (!Array.isArray(parsedValue)) {
      return null;
    }

    const defaults = createDefaultPreferences();
    const parsedByType = new Map<WidgetType, WidgetPreference>();

    for (const item of parsedValue) {
      const preference = parsePreference(item);

      if (preference) {
        parsedByType.set(preference.type, preference);
      }
    }

    if (parsedByType.size === 0) {
      return null;
    }

    return normalizeWidgetPreferences(
      defaults
        .map((preference) => parsedByType.get(preference.type) ?? preference)
        .sort((left, right) => left.position - right.position)
    );
  } catch {
    return null;
  }
}

export function widgetSupportsItemLimit(type: WidgetType): boolean {
  return type === "calendar" || type === "routines" || type === "news";
}

export function widgetSupportsRefresh(type: WidgetType): boolean {
  return type === "weather" || type === "calendar" || type === "news";
}

export function isWidgetType(value: string): value is WidgetType {
  return WIDGET_TYPES.some((type) => type === value);
}

type OptionKey =
  "itemLimit" | "refreshMinutes" | "temperatureUnit" | "newsSourceMode" | "calendarScope";
type RowMode = "open" | "thirds" | "quarters";

function toEditorSize(size: WidgetSize): EditorSize {
  if (size === "compact" || size === "standard" || size === "wide") {
    return size;
  }

  return "wide";
}

function packRow(previousEnabledSizes: readonly EditorSize[]): {
  mode: RowMode;
  remaining: number;
} {
  let remaining = DESKTOP_COLUMNS;
  let mode: RowMode = "open";

  for (const size of previousEnabledSizes) {
    const span = SIZE_SPAN[size];

    if (span > remaining) {
      remaining = DESKTOP_COLUMNS;
      mode = "open";
    }

    if (mode === "open") {
      mode = size === "standard" ? "quarters" : "thirds";
    }

    remaining -= span;

    if (remaining === 0) {
      remaining = DESKTOP_COLUMNS;
      mode = "open";
    }
  }

  return { mode, remaining };
}

function snapSize(current: EditorSize, allowed: readonly EditorSize[]): EditorSize {
  if (allowed.includes(current)) {
    return current;
  }

  const fallback = (["wide", "standard", "compact"] as const).find((size) =>
    allowed.includes(size)
  );
  return fallback ?? current;
}

function reindex(preferences: readonly WidgetPreference[]): readonly WidgetPreference[] {
  return preferences.map((widget, position) =>
    widget.position === position ? widget : { ...widget, position }
  );
}

function parsePreference(value: unknown): WidgetPreference | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  if (!("type" in value) || typeof value.type !== "string" || !isWidgetType(value.type)) {
    return null;
  }

  const size = "size" in value ? value.size : null;
  const itemLimit = "itemLimit" in value ? value.itemLimit : null;
  const refreshMinutes = "refreshMinutes" in value ? value.refreshMinutes : null;
  const temperatureUnit = "temperatureUnit" in value ? value.temperatureUnit : null;
  const newsSourceMode = "newsSourceMode" in value ? value.newsSourceMode : null;
  const calendarScope = "calendarScope" in value ? value.calendarScope : null;
  const enabled = "enabled" in value ? value.enabled : null;
  const position = "position" in value ? value.position : null;

  if (
    !isEditorSize(size) ||
    !isItemLimit(itemLimit) ||
    !isRefreshMinutes(refreshMinutes) ||
    (temperatureUnit !== "celsius" && temperatureUnit !== "fahrenheit") ||
    (newsSourceMode !== "all" && newsSourceMode !== "official") ||
    (calendarScope !== "all" && calendarScope !== "work") ||
    typeof enabled !== "boolean" ||
    typeof position !== "number" ||
    !Number.isInteger(position)
  ) {
    return null;
  }

  return {
    type: value.type,
    enabled,
    size,
    position,
    itemLimit,
    refreshMinutes,
    temperatureUnit,
    newsSourceMode,
    calendarScope
  };
}

function isEditorSize(value: unknown): value is EditorSize {
  return value === "compact" || value === "standard" || value === "wide";
}

function isItemLimit(value: unknown): value is ItemLimit {
  return ITEM_LIMITS.some((limit) => limit === value);
}

function isRefreshMinutes(value: unknown): value is RefreshMinutes {
  return REFRESH_MINUTES.some((minutes) => minutes === value);
}
