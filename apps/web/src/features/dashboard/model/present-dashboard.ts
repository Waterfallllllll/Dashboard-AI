import type { Dashboard, NewsTopic } from "@dashboard/contracts";
import type { CalendarEvent } from "@/features/calendar";
import type { NewsItem } from "@/features/news";
import type { RoutineOccurrence } from "@/features/routines";
import { timerSessionFromSnapshot, type TimerSession } from "@/features/timer";
import type { WeatherSnapshot } from "@/features/weather";

import { formatInZone } from "@/lib/format/date-time";

import type { WidgetStatus } from "./widget-status";

const NEWS_TOPIC_LABELS = {
  llm: "LLM",
  agents: "Агенты",
  research: "Исследования",
  devtools: "Инструменты",
  vision: "Зрение",
  robotics: "Робототехника",
  business: "Бизнес"
} as const satisfies Record<NewsTopic, NewsItem["topic"]>;

const CALENDAR_COLORS = ["#1f6feb", "#8a5a00", "#1a7f37", "#8250df"] as const;

export type PresentedSection<T> = Readonly<{
  status: WidgetStatus;
  data: T;
  updatedAt: number | null;
}>;

export type PresentedDashboard = Readonly<{
  generatedAt: string;
  timeZone: string;
  timeFormat: "12" | "24";
  datetime: PresentedSection<null>;
  weather: PresentedSection<WeatherSnapshot | null>;
  calendar: PresentedSection<readonly CalendarEvent[]>;
  routines: PresentedSection<readonly RoutineOccurrence[]>;
  timer: PresentedSection<TimerSession | null>;
  news: PresentedSection<readonly NewsItem[]>;
}>;

export function presentDashboard(dashboard: Dashboard, timeZone: string): PresentedDashboard {
  const accountZone =
    dashboard.datetime.status === "ready" ? dashboard.datetime.timezone : timeZone;
  const accountFormat =
    dashboard.datetime.status === "ready" ? dashboard.datetime.timeFormat : "24";

  return {
    generatedAt: dashboard.generatedAt,
    timeZone: accountZone,
    timeFormat: accountFormat,
    datetime: {
      status: dashboard.datetime.status === "ready" ? "success" : "error",
      data: null,
      updatedAt: null
    },
    weather: presentWeather(dashboard.weather, accountZone),
    calendar: presentCalendar(dashboard.calendar),
    routines: presentRoutines(dashboard.routines, dashboard.date),
    timer: presentTimer(dashboard.timer),
    news: presentNews(dashboard.news)
  };
}

function presentWeather(
  section: Dashboard["weather"],
  timeZone: string
): PresentedSection<WeatherSnapshot | null> {
  if (section.status !== "ready" && section.status !== "stale") {
    return { status: toWidgetStatus(section.status), data: null, updatedAt: null };
  }

  return {
    status: toWidgetStatus(section.status),
    updatedAt: timestamp(section.updatedAt),
    data: {
      locationLabel: section.weather.locationLabel,
      temperatureC: section.weather.temperature,
      apparentTemperatureC: section.weather.apparentTemperature,
      description: section.weather.description,
      precipitationProbability: section.weather.precipitationProbability,
      windSpeedKmh: section.weather.windSpeedKmh,
      minC: section.weather.min,
      maxC: section.weather.max,
      weatherCode: section.weather.weatherCode,
      isDay: section.weather.isDay,
      scene: section.weather.scene,
      updatedAt: timestamp(section.updatedAt) ?? Date.parse(section.updatedAt),
      hourly: section.weather.hourly.map((hour) => ({
        hourLabel: formatInZone(Date.parse(hour.at), timeZone, "HH:mm"),
        temperatureC: hour.temperature,
        precipitationProbability: hour.precipitationProbability,
        weatherCode: hour.weatherCode
      }))
    }
  };
}

function presentCalendar(
  section: Dashboard["calendar"]
): PresentedSection<readonly CalendarEvent[]> {
  if (section.status !== "ready" && section.status !== "stale") {
    return { status: toWidgetStatus(section.status), data: [], updatedAt: null };
  }

  return {
    status: toWidgetStatus(section.status),
    updatedAt: timestamp(section.updatedAt),
    data: section.events.map((event) => ({
      id: event.id,
      title: event.title,
      startAt: Date.parse(event.startAt),
      endAt: Date.parse(event.endAt),
      allDay: event.allDay,
      location: event.location,
      meetingUrl: event.meetingUrl,
      htmlLink: event.htmlLink,
      status: event.status,
      calendar: {
        name: event.calendarName,
        color: calendarColor(event.calendarName)
      }
    }))
  };
}

function presentNews(section: Dashboard["news"]): PresentedSection<readonly NewsItem[]> {
  if (section.status === "pending") {
    return { status: "loading", data: [], updatedAt: null };
  }

  if (section.status !== "ready" && section.status !== "stale") {
    return {
      status: toWidgetStatus(section.status),
      data: [],
      updatedAt: section.status === "empty" ? timestamp(section.updatedAt) : null
    };
  }

  return {
    status: toWidgetStatus(section.status),
    updatedAt: timestamp(section.updatedAt),
    data: section.items.map((item) => ({
      id: item.id,
      title: item.title,
      excerpt: item.excerpt,
      source: item.source,
      official: item.official,
      topic: NEWS_TOPIC_LABELS[item.topic],
      publishedAt: Date.parse(item.publishedAt),
      url: item.url
    }))
  };
}

function presentRoutines(
  section: Dashboard["routines"],
  anchor: string
): PresentedSection<readonly RoutineOccurrence[]> {
  if (section.status !== "ready") {
    return { status: "error", data: [], updatedAt: null };
  }

  const window = section.days;

  if (window && window[1]?.date === anchor) {
    const items = occurrencesFromWindow(window, anchor);

    return {
      status: items.length === 0 ? "empty" : "success",
      data: items,
      updatedAt: null
    };
  }

  const source = readRoutineItems(section.day);

  if (source === null) {
    return { status: "error", data: [], updatedAt: null };
  }

  return {
    status: source.some((item) => item.status !== "hidden") ? "success" : "empty",
    data: toOccurrences(source, 0),
    updatedAt: null
  };
}

const WINDOW_OFFSETS = [-1, 0, 1] as const;

type RoutineWindowDay = Extract<Dashboard["routines"], { status: "ready" }>["day"];

function occurrencesFromWindow(
  days: readonly RoutineWindowDay[],
  anchor: string
): RoutineOccurrence[] {
  return WINDOW_OFFSETS.flatMap((offset, index) => {
    const day = days[index];

    if (!day || day.date !== shiftIsoDate(anchor, offset)) {
      return [];
    }

    return toOccurrences(day.items, offset);
  });
}

function toOccurrences(
  items: readonly RoutineDayItem[],
  dayOffset: RoutineOccurrence["dayOffset"]
): RoutineOccurrence[] {
  return items
    .filter((item) => item.status !== "hidden")
    .map((item) => ({
      id: item.id,
      title: item.title,
      dayOffset,
      done: item.status === "done"
    }));
}

function shiftIsoDate(isoDate: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);

  if (!match) {
    return isoDate;
  }

  const utc = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
  return utc.toISOString().slice(0, 10);
}

function presentTimer(section: Dashboard["timer"]): PresentedSection<TimerSession | null> {
  if (section.status !== "ready") {
    return { status: "error", data: null, updatedAt: null };
  }

  return {
    status: "success",
    data: timerSessionFromSnapshot(section.timer),
    updatedAt: null
  };
}

function toWidgetStatus(
  status: "ready" | "stale" | "empty" | "unavailable" | "error"
): WidgetStatus {
  switch (status) {
    case "ready":
      return "success";
    case "stale":
      return "stale";
    case "empty":
      return "empty";
    case "unavailable":
      return "disconnected";
    case "error":
      return "error";
  }
}

type RoutineDayItem = Extract<Dashboard["routines"], { status: "ready" }>["day"]["items"][number];

function readRoutineItems(day: unknown): readonly RoutineDayItem[] | null {
  if (typeof day !== "object" || day === null || !("items" in day) || !Array.isArray(day.items)) {
    return null;
  }

  return day.items as readonly RoutineDayItem[];
}

function timestamp(value: string | null): number | null {
  if (value === null) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function calendarColor(name: string): string {
  let hash = 0;

  for (const char of name) {
    hash = (hash + char.charCodeAt(0)) % CALENDAR_COLORS.length;
  }

  return CALENDAR_COLORS[hash] ?? CALENDAR_COLORS[0];
}
