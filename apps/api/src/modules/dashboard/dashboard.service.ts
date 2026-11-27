import { SECTION_ERROR_MESSAGE } from "@dashboard/contracts";
import type {
  CalendarSection,
  Dashboard,
  NewsSection,
  RoutineDay,
  WeatherSection
} from "@dashboard/contracts";

import { addDays, localDateInTimeZone } from "../../shared/local-date.js";
import type { Viewer } from "../../shared/http/require-actor.js";
import type { RoutinesService } from "../routines/routines.service.js";
import type { TimersService } from "../timers/timers.service.js";
import type { WidgetsService } from "../widgets/widgets.service.js";

export type ExternalSectionSource<T = { readonly status: "unavailable" }> = {
  load(viewer: Viewer, date: string): Promise<T>;
};

export class UnavailableSectionSource
  implements
    ExternalSectionSource<WeatherSection>,
    ExternalSectionSource<CalendarSection>,
    ExternalSectionSource<NewsSection>
{
  async load(): Promise<{ status: "unavailable" }> {
    return { status: "unavailable" };
  }
}

const SECTION_DEADLINE_MS = 10_000;

type SectionError = { readonly status: "error"; readonly message: string };
type ReadyDatetime = {
  readonly status: "ready";
  readonly serverTime: string;
  readonly timezone: string;
  readonly timeFormat: "12" | "24";
};

export class DashboardService {
  constructor(
    private readonly widgets: WidgetsService,
    private readonly routines: RoutinesService,
    private readonly timers: TimersService,
    private readonly weather: ExternalSectionSource<WeatherSection>,
    private readonly calendar: ExternalSectionSource<CalendarSection>,
    private readonly news: ExternalSectionSource<NewsSection>,
    private readonly now: () => Date = () => new Date()
  ) {}

  async load(viewer: Viewer, date: string): Promise<Dashboard> {
    const now = this.now();
    const today = localDateInTimeZone(now, viewer.timezone);
    const [datetime, widgets, routines, timer, weather, calendar, news] = await Promise.allSettled([
      Promise.resolve(datetimeSection(viewer, now)),
      withDeadline(this.widgets.get(viewer)),
      withDeadline(loadRoutineWindow(this.routines, viewer, date, today)),
      withDeadline(this.timers.current(viewer, date, viewer.timezone)),
      withDeadline(this.weather.load(viewer, date)),
      withDeadline(this.calendar.load(viewer, date)),
      withDeadline(this.news.load(viewer, date))
    ]);

    return {
      date,
      generatedAt: now.toISOString(),
      datetime: mapSection(datetime, (section) => section),
      widgets: mapSection(widgets, (preferences) => ({ status: "ready" as const, preferences })),
      routines: mapSection(routines, (window) => ({
        status: "ready" as const,
        day: window.day,
        days: window.days
      })),
      timer: mapSection(timer, (snapshot) => ({ status: "ready" as const, timer: snapshot })),
      weather: externalSection(weather),
      calendar: externalSection(calendar),
      news: externalSection(news)
    };
  }
}

async function loadRoutineWindow(
  routines: RoutinesService,
  viewer: Viewer,
  date: string,
  today: string
): Promise<{ day: RoutineDay; days: [RoutineDay, RoutineDay, RoutineDay] }> {
  const [yesterday, day, tomorrow] = await Promise.all([
    routines.listDay(viewer, addDays(date, -1), today),
    routines.listDay(viewer, date, today),
    routines.listDay(viewer, addDays(date, 1), today)
  ]);

  return { day, days: [yesterday, day, tomorrow] };
}

function datetimeSection(viewer: Viewer, now: Date): ReadyDatetime {
  return {
    status: "ready",
    serverTime: now.toISOString(),
    timezone: viewer.timezone,
    timeFormat: viewer.timeFormat
  };
}

function mapSection<T, R>(result: PromiseSettledResult<T>, map: (value: T) => R): R | SectionError {
  if (result.status === "rejected") {
    return sectionError();
  }

  return map(result.value);
}

function externalSection<T>(result: PromiseSettledResult<T>): T | SectionError {
  if (result.status === "rejected") {
    return sectionError();
  }

  return result.value;
}

function sectionError(): SectionError {
  return { status: "error", message: SECTION_ERROR_MESSAGE };
}

function withDeadline<T>(work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let settled = false;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      if (!settled) {
        reject(new Error("section deadline"));
      }
    }, SECTION_DEADLINE_MS);
  });

  deadline.catch(() => undefined);
  work.catch(() => undefined);

  return Promise.race([
    work.finally(() => {
      settled = true;
    }),
    deadline
  ]).finally(() => {
    settled = true;
    clearTimeout(timer);
  });
}
