import { SECTION_ERROR_MESSAGE } from "@dashboard/contracts";
import type { Dashboard } from "@dashboard/contracts";

import { localDateInTimeZone } from "../../shared/local-date.js";
import type { Viewer } from "../../shared/http/require-actor.js";
import type { RoutinesService } from "../routines/routines.service.js";
import type { TimersService } from "../timers/timers.service.js";
import type { WidgetsService } from "../widgets/widgets.service.js";

export type ExternalSectionSource = {
  load(): Promise<"unavailable">;
};

export class UnavailableSectionSource implements ExternalSectionSource {
  async load(): Promise<"unavailable"> {
    return "unavailable";
  }
}

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
    private readonly weather: ExternalSectionSource,
    private readonly calendar: ExternalSectionSource,
    private readonly news: ExternalSectionSource,
    private readonly now: () => Date = () => new Date()
  ) {}

  async load(viewer: Viewer, date: string): Promise<Dashboard> {
    const now = this.now();
    const today = localDateInTimeZone(now, viewer.timezone);
    const [datetime, widgets, routines, timer, weather, calendar, news] = await Promise.allSettled([
      Promise.resolve(datetimeSection(viewer, now)),
      this.widgets.get(viewer),
      this.routines.listDay(viewer, date, today),
      this.timers.current(viewer, date, viewer.timezone),
      this.weather.load(),
      this.calendar.load(),
      this.news.load()
    ]);

    return {
      date,
      generatedAt: now.toISOString(),
      datetime: mapSection(datetime, (section) => section),
      widgets: mapSection(widgets, (preferences) => ({ status: "ready" as const, preferences })),
      routines: mapSection(routines, (day) => ({ status: "ready" as const, day })),
      timer: mapSection(timer, (snapshot) => ({ status: "ready" as const, timer: snapshot })),
      weather: externalSection(weather),
      calendar: externalSection(calendar),
      news: externalSection(news)
    };
  }
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

function externalSection(
  result: PromiseSettledResult<"unavailable">
): { status: "unavailable" } | SectionError {
  if (result.status === "rejected") {
    return sectionError();
  }

  return { status: "unavailable" };
}

function sectionError(): SectionError {
  return { status: "error", message: SECTION_ERROR_MESSAGE };
}
