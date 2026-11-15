import type {
  CalendarEvent as ApiCalendarEvent,
  Dashboard,
  NewsItem as ApiNewsItem,
  RoutineDay,
  TimerSnapshot,
  WeatherSnapshot as ApiWeather
} from "@dashboard/contracts";

import type { CalendarEvent } from "@/features/calendar";
import type { NewsItem, NewsTopic } from "@/features/news";
import type { RoutineOccurrence } from "@/features/routines";
import type { TimerSession } from "@/features/timer";
import type { WeatherSnapshot } from "@/features/weather";
import { formatInZone } from "@/lib/format/date-time";

type WidgetType = "datetime" | "weather" | "calendar" | "routines" | "timer" | "news";
type WidgetStatus =
  | "loading"
  | "success"
  | "empty"
  | "permission-required"
  | "disconnected"
  | "stale"
  | "error";

const IDLE_DURATION_MS = 25 * 60 * 1000;
const CALENDAR_COLORS = ["#3d7a5a", "#2f6f8f", "#8a6232", "#6b4c7a", "#3f6b4a"] as const;

const NEWS_TOPIC_LABELS: Readonly<Record<ApiNewsItem["topic"], NewsTopic>> = {
  llm: "LLM",
  agents: "Агенты",
  research: "Исследования",
  devtools: "Инструменты",
  vision: "Зрение",
  robotics: "Робототехника",
  business: "Бизнес"
};

export type RemoteTimerRef = Readonly<{
  id: string;
  version: number;
}>;

export type RemoteDashboard = Readonly<{
  date: string;
  timeZone: string;
  timeFormat: "12" | "24";
  serverNow: number;
  states: Partial<Record<WidgetType, WidgetStatus>>;
  weather: WeatherSnapshot | null;
  calendarEvents: readonly CalendarEvent[] | null;
  newsItems: readonly NewsItem[] | null;
  routineItems: readonly RoutineOccurrence[] | null;
  timer: TimerSession | null;
  timerRemote: RemoteTimerRef | null;
}>;

export function mapDashboard(input: {
  date: string;
  timeZone: string;
  timeFormat: "12" | "24";
  dashboard: Dashboard | null;
  yesterday: RoutineDay | null;
  tomorrow: RoutineDay | null;
}): RemoteDashboard {
  const dashboard = input.dashboard;
  const datetime = dashboard?.datetime;
  const timeZone = datetime?.status === "ready" ? datetime.timezone : input.timeZone;
  const timeFormat = datetime?.status === "ready" ? datetime.timeFormat : input.timeFormat;
  const parsedServerNow =
    datetime?.status === "ready" ? Date.parse(datetime.serverTime) : Date.parse(dashboard?.generatedAt ?? "");
  const weather = mapWeather(dashboard, timeZone);
  const calendar = mapCalendar(dashboard);
  const news = mapNews(dashboard);
  const routines = mapRoutines(dashboard, input.yesterday, input.tomorrow);
  const timer = mapTimer(dashboard);

  return {
    date: input.date,
    timeZone,
    timeFormat,
    serverNow: Number.isNaN(parsedServerNow) ? Date.now() : parsedServerNow,
    states: {
      datetime: datetime?.status === "error" ? "error" : "success",
      weather: weather.status,
      calendar: calendar.status,
      news: news.status,
      routines: routines.status,
      timer: timer.status
    },
    weather: weather.snapshot,
    calendarEvents: calendar.events,
    newsItems: news.items,
    routineItems: routines.items,
    timer: timer.session,
    timerRemote: timer.remote
  };
}

function mapWeather(
  dashboard: Dashboard | null,
  timeZone: string
): { status: WidgetStatus; snapshot: WeatherSnapshot | null } {
  const section = dashboard?.weather;

  if (!section || section.status === "unavailable") {
    return { status: dashboard ? "permission-required" : "error", snapshot: null };
  }

  if (section.status === "error") {
    return { status: "error", snapshot: null };
  }

  return {
    status: section.status === "stale" ? "stale" : "success",
    snapshot: toWeatherSnapshot(section.weather, Date.parse(section.updatedAt), timeZone)
  };
}

function mapCalendar(dashboard: Dashboard | null): {
  status: WidgetStatus;
  events: readonly CalendarEvent[] | null;
} {
  const section = dashboard?.calendar;

  if (!section || section.status === "unavailable") {
    return { status: dashboard ? "disconnected" : "error", events: null };
  }

  if (section.status === "error") {
    return { status: "error", events: null };
  }

  if (section.status === "empty") {
    return { status: "empty", events: [] };
  }

  const events = section.events.map(toCalendarEvent);

  return {
    status: section.status === "stale" ? "stale" : events.length === 0 ? "empty" : "success",
    events
  };
}

function mapNews(dashboard: Dashboard | null): {
  status: WidgetStatus;
  items: readonly NewsItem[] | null;
} {
  const section = dashboard?.news;

  if (!section || section.status === "unavailable") {
    return { status: "error", items: null };
  }

  if (section.status === "error") {
    return { status: "error", items: null };
  }

  if (section.status === "empty") {
    return { status: "empty", items: [] };
  }

  return {
    status: section.status === "stale" ? "stale" : section.items.length === 0 ? "empty" : "success",
    items: section.items.map(toNewsItem)
  };
}

function mapRoutines(
  dashboard: Dashboard | null,
  yesterday: RoutineDay | null,
  tomorrow: RoutineDay | null
): { status: WidgetStatus; items: readonly RoutineOccurrence[] | null } {
  const section = dashboard?.routines;

  if (!section || section.status === "error") {
    return { status: "error", items: null };
  }

  const items = [
    ...toRoutineItems(yesterday, -1),
    ...toRoutineItems(section.day, 0),
    ...toRoutineItems(tomorrow, 1)
  ];

  return {
    status: items.length === 0 ? "empty" : "success",
    items
  };
}

function mapTimer(dashboard: Dashboard | null): {
  status: WidgetStatus;
  session: TimerSession | null;
  remote: RemoteTimerRef | null;
} {
  const section = dashboard?.timer;

  if (!section || section.status === "error") {
    return { status: "error", session: null, remote: null };
  }

  const remoteSession = section.timer.session;

  return {
    status: "success",
    session: toTimerSession(section.timer),
    remote: remoteSession ? { id: remoteSession.id, version: remoteSession.version } : null
  };
}

function toWeatherSnapshot(weather: ApiWeather, updatedAt: number, timeZone: string): WeatherSnapshot {
  return {
    locationLabel: weather.locationLabel,
    temperatureC: toCelsius(weather.temperature, weather.unit),
    apparentTemperatureC: toCelsius(weather.apparentTemperature, weather.unit),
    description: weather.description,
    precipitationProbability: weather.precipitationProbability,
    windSpeedKmh: weather.windSpeedKmh,
    minC: toCelsius(weather.min, weather.unit),
    maxC: toCelsius(weather.max, weather.unit),
    weatherCode: weather.weatherCode,
    isDay: weather.isDay,
    scene: weather.scene,
    updatedAt: Number.isNaN(updatedAt) ? Date.now() : updatedAt,
    hourly: weather.hourly.map((hour) => ({
      hourLabel: formatInZone(Date.parse(hour.at), timeZone, "HH:mm"),
      temperatureC: toCelsius(hour.temperature, weather.unit),
      precipitationProbability: hour.precipitationProbability,
      weatherCode: hour.weatherCode
    }))
  };
}

function toCalendarEvent(event: ApiCalendarEvent): CalendarEvent {
  return {
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
      color: colorFor(event.calendarName)
    }
  };
}

function toNewsItem(item: ApiNewsItem): NewsItem {
  return {
    id: item.id,
    title: item.title,
    excerpt: item.excerpt,
    source: item.source,
    official: item.official,
    topic: NEWS_TOPIC_LABELS[item.topic],
    publishedAt: Date.parse(item.publishedAt),
    url: item.url
  };
}

function toRoutineItems(
  day: RoutineDay | null,
  dayOffset: RoutineOccurrence["dayOffset"]
): RoutineOccurrence[] {
  if (!day) {
    return [];
  }

  return day.items.flatMap((item) => {
    if (item.status === "hidden") {
      return [];
    }

    return [
      {
        id: item.id,
        title: item.title,
        dayOffset,
        done: item.status === "done"
      }
    ];
  });
}

export function toTimerSession(snapshot: TimerSnapshot): TimerSession {
  const session = snapshot.session;
  const durationMs = session?.durationMs || IDLE_DURATION_MS;

  return {
    mode: "pomodoro",
    phase: session?.phase ?? snapshot.next.phase,
    runStatus: session?.runStatus ?? "idle",
    durationMs,
    remainingMs: session?.remainingMs ?? durationMs,
    endsAt: session?.endsAt ? Date.parse(session.endsAt) : null,
    completedWorkInCycle: session?.cycleNumber ?? snapshot.next.cycleNumber,
    completedWorkToday: snapshot.completedToday,
    dailyGoal: snapshot.dailyGoal
  };
}

function toCelsius(value: number, unit: "celsius" | "fahrenheit"): number {
  return unit === "fahrenheit" ? ((value - 32) * 5) / 9 : value;
}

function colorFor(name: string): string {
  let hash = 0;

  for (const char of name) {
    hash = (hash + char.charCodeAt(0)) % CALENDAR_COLORS.length;
  }

  return CALENDAR_COLORS[hash] ?? CALENDAR_COLORS[0];
}
