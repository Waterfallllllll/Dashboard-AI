import type {
  WidgetPreferencePatch,
  WidgetSettings,
  WidgetSize,
  WidgetType
} from "@dashboard/contracts";

const DESKTOP_COLUMNS = 12;

const ALLOWED_SETTINGS: Readonly<Record<WidgetType, readonly string[]>> = {
  datetime: [],
  weather: ["refreshMinutes", "temperatureUnit"],
  calendar: ["itemLimit", "refreshMinutes", "calendarScope"],
  routines: ["itemLimit"],
  timer: ["dailyGoal", "volume"],
  news: ["itemLimit", "refreshMinutes", "newsSourceMode"]
};

export const DEFAULT_WIDGET_ORDER: readonly Readonly<{
  widgetType: WidgetType;
  size: WidgetSize;
}>[] = [
  { widgetType: "datetime", size: "compact" },
  { widgetType: "weather", size: "wide" },
  { widgetType: "calendar", size: "compact" },
  { widgetType: "routines", size: "standard" },
  { widgetType: "timer", size: "standard" },
  { widgetType: "news", size: "standard" }
];

type RowMode = "open" | "thirds" | "quarters";

export function defaultWidgetSettings(type: WidgetType): WidgetSettings {
  switch (type) {
    case "datetime":
      return {};
    case "weather":
      return { refreshMinutes: 30, temperatureUnit: "celsius" };
    case "calendar":
      return { itemLimit: 5, refreshMinutes: 30, calendarScope: "all" };
    case "routines":
      return { itemLimit: 10 };
    case "timer":
      return { dailyGoal: 8, volume: 0.4 };
    case "news":
      return { itemLimit: 5, refreshMinutes: 30, newsSourceMode: "all" };
  }
}

export function normalizeSettings(type: WidgetType, settings: WidgetSettings): WidgetSettings {
  switch (type) {
    case "datetime":
      return {};
    case "weather":
      return {
        refreshMinutes: settings.refreshMinutes ?? 30,
        temperatureUnit: settings.temperatureUnit ?? "celsius"
      };
    case "calendar":
      return {
        itemLimit: settings.itemLimit ?? 5,
        refreshMinutes: settings.refreshMinutes ?? 30,
        calendarScope: settings.calendarScope ?? "all"
      };
    case "routines":
      return { itemLimit: settings.itemLimit ?? 10 };
    case "timer":
      return {
        dailyGoal: settings.dailyGoal ?? 8,
        volume: settings.volume ?? 0.4
      };
    case "news":
      return {
        itemLimit: settings.itemLimit ?? 5,
        refreshMinutes: settings.refreshMinutes ?? 30,
        newsSourceMode: settings.newsSourceMode ?? "all"
      };
  }
}

export function layoutFieldErrors(
  widgets: readonly WidgetPreferencePatch[]
): Record<string, string[]> | null {
  if (widgets.length !== 6) {
    return { widgets: ["Нужны все шесть виджетов."] };
  }

  const types = new Set(widgets.map((widget) => widget.widgetType));

  if (types.size !== 6) {
    return { widgets: ["Каждый виджет указывается один раз."] };
  }

  const positions = new Set(widgets.map((widget) => widget.position));

  if (positions.size !== 6 || widgets.some((widget) => widget.position > 5)) {
    return { widgets: ["Позиции должны идти от 0 до 5 без пропусков."] };
  }

  const errors: Record<string, string[]> = {};
  const sorted = [...widgets].sort((left, right) => left.position - right.position);
  const enabled: WidgetSize[] = [];

  for (const widget of sorted) {
    if (foreignSetting(widget.widgetType, widget.settings)) {
      pushError(errors, widget.widgetType, "Эта настройка не относится к виджету.");
    }

    if (!widget.enabled) {
      continue;
    }

    if (!allowedWidgetSizes(enabled).includes(widget.size)) {
      pushError(errors, widget.widgetType, "Размер виджета оставляет пустой промежуток в сетке.");
    }

    enabled.push(widget.size);
  }

  return Object.keys(errors).length > 0 ? errors : null;
}

export function allowedWidgetSizes(previous: readonly WidgetSize[]): readonly WidgetSize[] {
  const { mode, remaining } = packRow(previous);

  if (mode === "open") {
    return ["compact", "standard", "wide", "full"];
  }

  if (mode === "quarters") {
    return remaining >= spanOf("standard") ? ["standard"] : ["compact", "standard", "wide", "full"];
  }

  const sizes: WidgetSize[] = [];

  if (remaining >= spanOf("compact")) {
    sizes.push("compact");
  }

  if (remaining >= spanOf("wide")) {
    sizes.push("wide");
  }

  return sizes.length > 0 ? sizes : ["compact", "standard", "wide", "full"];
}

function packRow(previous: readonly WidgetSize[]): { mode: RowMode; remaining: number } {
  let remaining = DESKTOP_COLUMNS;
  let mode: RowMode = "open";

  for (const size of previous) {
    const span = spanOf(size);

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

function spanOf(size: WidgetSize): number {
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

function foreignSetting(type: WidgetType, settings: WidgetSettings): boolean {
  const allowed = ALLOWED_SETTINGS[type];
  return Object.keys(settings).some((key) => !allowed.includes(key));
}

function pushError(target: Record<string, string[]>, key: string, message: string): void {
  const existing = target[key] ?? [];

  if (!existing.includes(message)) {
    target[key] = [...existing, message];
  }
}
