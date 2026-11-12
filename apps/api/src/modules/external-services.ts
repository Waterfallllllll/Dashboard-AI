import type { CredentialCipher } from "../infrastructure/crypto/credential-cipher.js";
import type { FetchLike } from "../infrastructure/http/provider-guard.js";
import type { TelegramBotConfig } from "../config/env.js";
import { OAUTH_STATE_TTL_MS } from "../config/constants.js";
import { DashboardService } from "./dashboard/dashboard.service.js";
import { CalendarService } from "./calendar/calendar.service.js";
import type { CalendarGateway } from "./calendar/google-calendar-gateway.js";
import type { CalendarRepository } from "./calendar/calendar.repository.js";
import { IntegrationsService } from "./integrations/integrations.service.js";
import type { CalendarOAuthClient } from "./integrations/google-calendar-oauth.js";
import type { IntegrationsRepository } from "./integrations/integrations.repository.js";
import { TelegramClient } from "./integrations/telegram-client.js";
import type { AuditRecorder } from "./audit/audit.service.js";
import { NewsService } from "./news/news.service.js";
import type { NewsRepository } from "./news/news.repository.js";
import type { RoutinesService } from "./routines/routines.service.js";
import type { TimersService } from "./timers/timers.service.js";
import type { UsersRepository } from "./users/users.repository.js";
import { WeatherService } from "./weather/weather.service.js";
import type { WidgetsService } from "./widgets/widgets.service.js";

export type ExternalServices = {
  readonly weather: WeatherService;
  readonly news: NewsService;
  readonly calendar: CalendarService;
  readonly integrations: IntegrationsService;
  readonly dashboard: DashboardService;
};

export function createExternalServices(input: {
  readonly widgets: WidgetsService;
  readonly routines: RoutinesService;
  readonly timers: TimersService;
  readonly users: UsersRepository;
  readonly integrations: IntegrationsRepository;
  readonly news: NewsRepository;
  readonly events: CalendarRepository;
  readonly cipher: CredentialCipher;
  readonly fetchImpl: FetchLike;
  readonly oauth: CalendarOAuthClient;
  readonly gateway: CalendarGateway;
  readonly weatherApiBaseUrl: string;
  readonly telegram: TelegramBotConfig | null;
  readonly now?: () => Date;
  readonly audit?: AuditRecorder;
}): ExternalServices {
  const clock = input.now ?? (() => new Date());
  const integrations = new IntegrationsService(
    input.integrations,
    input.cipher,
    input.oauth,
    input.telegram
      ? new TelegramClient(input.telegram.token, input.telegram.username, input.fetchImpl, () =>
          clock().getTime()
        )
      : null,
    input.telegram?.username ?? null,
    clock,
    OAUTH_STATE_TTL_MS,
    input.audit
  );
  const weather = new WeatherService(
    {
      read: (actor) => input.users.readWeatherLocation(actor.userId),
      write: (actor, place) => input.users.writeWeatherLocation(actor.userId, place, clock())
    },
    { unit: (actor) => input.widgets.temperatureUnit(actor) },
    input.fetchImpl,
    input.weatherApiBaseUrl,
    undefined,
    undefined,
    clock
  );
  const news = new NewsService(
    input.news,
    { read: (actor) => input.widgets.newsPreference(actor) },
    input.fetchImpl,
    undefined,
    clock
  );
  const calendar = new CalendarService(
    input.events,
    {
      state: (userId) => integrations.calendarState(userId),
      saveSync: (userId, cursor, accessToken, syncedAt) =>
        integrations.saveCalendarSync(userId, cursor, accessToken, syncedAt),
      markRevoked: (userId, syncedAt) => integrations.markCalendarRevoked(userId, syncedAt)
    },
    input.gateway,
    { limit: (actor) => input.widgets.calendarLimit(actor) },
    clock
  );

  return {
    weather,
    news,
    calendar,
    integrations,
    dashboard: new DashboardService(
      input.widgets,
      input.routines,
      input.timers,
      weather,
      calendar,
      news,
      clock
    )
  };
}
