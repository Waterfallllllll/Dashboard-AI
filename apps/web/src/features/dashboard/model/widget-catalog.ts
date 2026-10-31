export const WIDGET_TYPES = [
  "datetime",
  "weather",
  "calendar",
  "routines",
  "timer",
  "news"
] as const;

export type WidgetType = (typeof WIDGET_TYPES)[number];

export const WIDGET_SIZES = ["compact", "standard", "wide", "full"] as const;

export type WidgetSize = (typeof WIDGET_SIZES)[number];

export type WidgetPlacement = Readonly<{
  type: WidgetType;
  size: WidgetSize;
  enabled: boolean;
  position: number;
  hasExternalSource: boolean;
}>;

export const WIDGET_TITLES: Readonly<Record<WidgetType, string>> = {
  datetime: "Дата и время",
  weather: "Погода",
  calendar: "Календарь",
  routines: "Рутины",
  timer: "Таймер",
  news: "Новости"
};

export const DEFAULT_WIDGET_LAYOUT: readonly WidgetPlacement[] = [
  { type: "datetime", size: "compact", enabled: true, position: 0, hasExternalSource: false },
  { type: "weather", size: "wide", enabled: true, position: 1, hasExternalSource: true },
  { type: "timer", size: "compact", enabled: true, position: 2, hasExternalSource: false },
  { type: "calendar", size: "standard", enabled: true, position: 3, hasExternalSource: true },
  { type: "routines", size: "standard", enabled: true, position: 4, hasExternalSource: false },
  { type: "news", size: "standard", enabled: true, position: 5, hasExternalSource: true }
];
