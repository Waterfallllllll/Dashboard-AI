import {
  CSRF_HEADER,
  sessionResponseSchema,
  weatherLocationResponseSchema,
  weatherPlacesResponseSchema,
  type WeatherPlace
} from "@dashboard/contracts";

export type WeatherPlaceErrorCode = "unauthenticated" | "unavailable";

export class WeatherPlaceError extends Error {
  readonly code: WeatherPlaceErrorCode;

  constructor(code: WeatherPlaceErrorCode) {
    super(code === "unauthenticated" ? "Сначала войдите в аккаунт." : "Не удалось сохранить место.");
    this.name = "WeatherPlaceError";
    this.code = code;
  }
}

export async function loadWeatherPlace(
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal
): Promise<WeatherPlace | null> {
  const response = await readResponse(
    fetchImpl("/api/v1/weather/location", {
      cache: "no-store",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      ...(signal ? { signal } : {})
    })
  );
  const parsed = weatherLocationResponseSchema.safeParse(await readJson(response));

  if (!parsed.success) {
    throw new WeatherPlaceError("unavailable");
  }

  return parsed.data.data.location;
}

export async function searchWeatherPlaces(
  query: string,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal
): Promise<readonly WeatherPlace[]> {
  const response = await readResponse(
    fetchImpl(`/api/v1/weather/places?query=${encodeURIComponent(query)}`, {
      cache: "no-store",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      ...(signal ? { signal } : {})
    })
  );
  const parsed = weatherPlacesResponseSchema.safeParse(await readJson(response));

  if (!parsed.success) {
    throw new WeatherPlaceError("unavailable");
  }

  return parsed.data.data.places;
}

export async function saveWeatherPlace(
  place: WeatherPlace,
  fetchImpl: typeof fetch = fetch
): Promise<WeatherPlace> {
  const response = await readResponse(
    fetchImpl("/api/v1/weather/location", {
      method: "PUT",
      cache: "no-store",
      credentials: "same-origin",
      headers: await mutationHeaders(fetchImpl),
      body: JSON.stringify({
        latitude: place.latitude,
        longitude: place.longitude,
        label: place.label
      })
    })
  );
  const parsed = weatherLocationResponseSchema.safeParse(await readJson(response));
  const location = parsed.success ? parsed.data.data.location : null;

  if (!location) {
    throw new WeatherPlaceError("unavailable");
  }

  return location;
}

export async function clearWeatherPlace(fetchImpl: typeof fetch = fetch): Promise<void> {
  const response = await readResponse(
    fetchImpl("/api/v1/weather/location", {
      method: "DELETE",
      cache: "no-store",
      credentials: "same-origin",
      headers: await mutationHeaders(fetchImpl, false)
    })
  );
  const parsed = weatherLocationResponseSchema.safeParse(await readJson(response));

  if (!parsed.success || parsed.data.data.location !== null) {
    throw new WeatherPlaceError("unavailable");
  }
}

async function mutationHeaders(fetchImpl: typeof fetch, json = true): Promise<Headers> {
  const headers = new Headers({
    Accept: "application/json",
    [CSRF_HEADER]: await readCsrfToken(fetchImpl)
  });

  if (json) {
    headers.set("Content-Type", "application/json");
  }

  return headers;
}

async function readCsrfToken(fetchImpl: typeof fetch): Promise<string> {
  const response = await readResponse(
    fetchImpl("/api/v1/auth/session", {
      cache: "no-store",
      credentials: "same-origin",
      headers: { Accept: "application/json" }
    })
  );
  const parsed = sessionResponseSchema.safeParse(await readJson(response));

  if (!parsed.success) {
    throw new WeatherPlaceError("unavailable");
  }

  return parsed.data.data.csrfToken;
}

async function readResponse(pending: Promise<Response>): Promise<Response> {
  try {
    const response = await pending;

    if (response.status === 401) {
      throw new WeatherPlaceError("unauthenticated");
    }

    if (!response.ok) {
      throw new WeatherPlaceError("unavailable");
    }

    return response;
  } catch (error) {
    if (error instanceof WeatherPlaceError || isAbortError(error)) {
      throw error;
    }

    throw new WeatherPlaceError("unavailable");
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }

    throw new WeatherPlaceError("unavailable");
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
