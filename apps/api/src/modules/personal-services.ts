import {
  DashboardService,
  UnavailableSectionSource,
  type ExternalSectionSource
} from "./dashboard/dashboard.service.js";
import type { RoutinesRepository } from "./routines/routines.repository.js";
import { RoutinesService } from "./routines/routines.service.js";
import type { TimersRepository } from "./timers/timers.repository.js";
import { TimersService } from "./timers/timers.service.js";
import type { WidgetsRepository } from "./widgets/widgets.repository.js";
import { WidgetsService } from "./widgets/widgets.service.js";

export type PersonalRepositories = {
  readonly widgets: WidgetsRepository;
  readonly routines: RoutinesRepository;
  readonly timers: TimersRepository;
};

export type PersonalServices = {
  readonly widgets: WidgetsService;
  readonly routines: RoutinesService;
  readonly timers: TimersService;
  readonly dashboard: DashboardService;
};

export function createPersonalServices(
  repositories: PersonalRepositories,
  options?: {
    readonly now?: () => Date;
    readonly weather?: ExternalSectionSource;
    readonly calendar?: ExternalSectionSource;
    readonly news?: ExternalSectionSource;
  }
): PersonalServices {
  const now = options?.now;
  const widgets = new WidgetsService(repositories.widgets, now);
  const routines = new RoutinesService(repositories.routines, now);
  const timers = new TimersService(repositories.timers, widgets, now);
  const unavailable = new UnavailableSectionSource();

  return {
    widgets,
    routines,
    timers,
    dashboard: new DashboardService(
      widgets,
      routines,
      timers,
      options?.weather ?? unavailable,
      options?.calendar ?? unavailable,
      options?.news ?? unavailable,
      now
    )
  };
}
