import { API_ERROR_CODES, SECTION_ERROR_MESSAGE } from "@dashboard/contracts";
import type {
  PlaceQuery,
  WeatherPlace,
  WeatherQuery,
  WeatherSection,
  WeatherSnapshot
} from "@dashboard/contracts";

import {
  CircuitBreaker,
  ProviderUnavailableError,
  fetchAllowlisted,
  type FetchLike
} from "../../infrastructure/http/provider-guard.js";
import type { Viewer } from "../../shared/http/require-actor.js";
import { ApiError } from "../../shared/errors/api-error.js";
import type { Actor } from "../auth/auth.types.js";
import {
  cacheKey,
  forecastUrl,
  geocodingUrl,
  parseForecast,
  parsePlaces,
  roundPlace,
  WeatherCache
} from "./weather-model.js";

const OPEN_METEO_HOST = "api.open-meteo.com";
const OPEN_METEO_GEO_HOST = "geocoding-api.open-meteo.com";
const DASHBOARD_BUDGET_MS = 400;

export type WeatherLocationPort = {
  read(actor: Actor): Promise<WeatherPlace | null>;
  write(actor: Actor, place: WeatherPlace | null): Promise<boolean>;
};

export type TemperaturePort = {
  unit(actor: Actor): Promise<WeatherSnapshot["unit"]>;
};

export class WeatherService {
  private readonly cache = new WeatherCache(() => this.now().getTime());
  private readonly inflight = new Map<string, Promise<WeatherSection>>();

  constructor(
    private readonly locations: WeatherLocationPort,
    private readonly temperature: TemperaturePort,
    private readonly fetchImpl: FetchLike,
    private readonly baseUrl: string,
    private readonly forecastBreaker = new CircuitBreaker(),
    private readonly geoBreaker = new CircuitBreaker(),
    private readonly now: () => Date = () => new Date()
  ) {}

  async load(viewer: Viewer): Promise<WeatherSection> {
    return this.section(viewer, await this.locations.read(viewer), "wait");
  }

  async loadForDashboard(viewer: Viewer): Promise<WeatherSection> {
    return this.section(viewer, await this.locations.read(viewer), "budget");
  }

  async forCoordinates(viewer: Viewer, query: WeatherQuery): Promise<WeatherSection> {
    if (query.latitude === undefined || query.longitude === undefined) {
      return this.load(viewer);
    }

    return this.section(
      viewer,
      roundPlace(Number(query.latitude), Number(query.longitude), "Выбранная точка"),
      "wait"
    );
  }

  async search(query: PlaceQuery): Promise<WeatherPlace[]> {
    try {
      const body = await fetchAllowlisted({
        url: geocodingUrl(query.query),
        allowHosts: [OPEN_METEO_GEO_HOST],
        provider: "weather",
        fetchImpl: this.fetchImpl,
        breaker: this.geoBreaker
      });
      return parsePlaces(parseJson(body));
    } catch (error) {
      if (error instanceof ProviderUnavailableError || error instanceof SyntaxError) {
        throw new ApiError({ code: API_ERROR_CODES.unavailable });
      }

      throw error;
    }
  }

  async save(actor: Actor, place: WeatherPlace): Promise<WeatherPlace> {
    const rounded = roundPlace(place.latitude, place.longitude, place.label);

    if (!rounded) {
      throw new ApiError({ code: API_ERROR_CODES.validationFailed });
    }

    if (!(await this.locations.write(actor, rounded))) {
      throw new ApiError({ code: API_ERROR_CODES.unauthenticated });
    }

    return rounded;
  }

  async clear(actor: Actor): Promise<void> {
    if (!(await this.locations.write(actor, null))) {
      throw new ApiError({ code: API_ERROR_CODES.unauthenticated });
    }
  }

  async current(actor: Actor): Promise<WeatherPlace | null> {
    return this.locations.read(actor);
  }

  private async section(
    viewer: Viewer,
    place: WeatherPlace | null,
    mode: "wait" | "budget"
  ): Promise<WeatherSection> {
    try {
      if (!place) {
        return { status: "unavailable" };
      }

      const unit = await this.temperature.unit(viewer);
      const key = cacheKey(place, unit);
      const fresh = this.cache.fresh(key);

      if (fresh) {
        return { status: "ready", updatedAt: fresh.updatedAt, weather: fresh.weather };
      }

      const pending = this.enqueue(viewer, place, unit, key);

      if (mode === "wait") {
        return pending;
      }

      const stale = this.cache.stale(key);

      if (stale) {
        return { status: "stale", updatedAt: stale.updatedAt, weather: stale.weather };
      }

      // Быстрый отказ провайдера не должен залипать в error на дашборде:
      // фронт догрузит прогноз отдельным /weather с полным ожиданием.
      return budget(
        pending.then((section) =>
          section.status === "error" ? { status: "unavailable" as const } : section
        ),
        { status: "unavailable" },
        DASHBOARD_BUDGET_MS
      );
    } catch {
      return { status: "error", message: SECTION_ERROR_MESSAGE };
    }
  }

  private enqueue(
    viewer: Viewer,
    place: WeatherPlace,
    unit: WeatherSnapshot["unit"],
    key: string
  ): Promise<WeatherSection> {
    const existing = this.inflight.get(key);

    if (existing) {
      return existing;
    }

    const pending = this.fetchSection(viewer, place, unit, key).finally(() => {
      this.inflight.delete(key);
    });
    this.inflight.set(key, pending);
    return pending;
  }

  private async fetchSection(
    viewer: Viewer,
    place: WeatherPlace,
    unit: WeatherSnapshot["unit"],
    key: string
  ): Promise<WeatherSection> {
    try {
      const weather = await this.fetchForecast(place, unit, viewer.timezone);
      const updatedAt = this.now().toISOString();
      this.cache.put(key, weather, updatedAt);
      return { status: "ready", updatedAt, weather };
    } catch (error) {
      if (!(error instanceof ProviderUnavailableError)) {
        return { status: "error", message: SECTION_ERROR_MESSAGE };
      }

      const stale = this.cache.stale(key);
      return stale
        ? { status: "stale", updatedAt: stale.updatedAt, weather: stale.weather }
        : { status: "error", message: SECTION_ERROR_MESSAGE };
    }
  }

  private async fetchForecast(
    place: WeatherPlace,
    unit: WeatherSnapshot["unit"],
    timeZone: string
  ): Promise<WeatherSnapshot> {
    const body = await fetchAllowlisted({
      url: forecastUrl(this.baseUrl, place, unit, providerTimeZone(timeZone)),
      allowHosts: [OPEN_METEO_HOST],
      provider: "weather",
      fetchImpl: this.fetchImpl,
      breaker: this.forecastBreaker,
      maxAttempts: 2,
      timeoutMs: 8_000
    });
    const weather = parseForecast(parseJson(body), place, unit, this.now());

    if (!weather) {
      throw new ProviderUnavailableError("weather");
    }

    return weather;
  }
}

function providerTimeZone(value: string): string {
  return /^[A-Za-z0-9_+-]{1,32}(?:\/[A-Za-z0-9_+-]{1,32}){0,2}$/.test(value) ? value : "UTC";
}

function parseJson(body: string): unknown {
  return JSON.parse(body) as unknown;
}

function budget<T>(pending: Promise<T>, fallback: T, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      resolve(fallback);
    }, ms);
  });

  return Promise.race([pending, deadline]).finally(() => {
    clearTimeout(timer);
  });
}
