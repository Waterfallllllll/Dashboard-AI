import {
  SECTION_ERROR_MESSAGE,
  apiSuccessSchema,
  dashboardResponseSchema,
  weatherSectionSchema,
  type Dashboard,
  type WeatherSection
} from "@dashboard/contracts";

export type DashboardLoad =
  { readonly status: "anonymous" } | { readonly status: "ready"; readonly dashboard: Dashboard };

export class DashboardLoadError extends Error {
  constructor() {
    super("Не удалось загрузить данные.");
    this.name = "DashboardLoadError";
  }
}

export async function loadDashboard(
  date: string,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal
): Promise<DashboardLoad> {
  const response = await readResponse(
    fetchImpl(`/api/v1/dashboard?date=${encodeURIComponent(date)}`, requestInit(signal))
  );

  if (response.status === 401) {
    return { status: "anonymous" };
  }

  if (!response.ok) {
    throw new DashboardLoadError();
  }

  const parsed = dashboardResponseSchema.safeParse(await readJson(response));

  if (!parsed.success) {
    throw new DashboardLoadError();
  }

  return { status: "ready", dashboard: parsed.data.data };
}

const weatherSectionResponseSchema = apiSuccessSchema(weatherSectionSchema);

export async function loadWeatherSection(
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal
): Promise<WeatherSection> {
  try {
    const response = await fetchImpl("/api/v1/weather", requestInit(signal));

    if (!response.ok) {
      return { status: "error", message: SECTION_ERROR_MESSAGE };
    }

    const parsed = weatherSectionResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data.data : { status: "error", message: SECTION_ERROR_MESSAGE };
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }

    return { status: "error", message: SECTION_ERROR_MESSAGE };
  }
}

function requestInit(signal?: AbortSignal): RequestInit {
  return {
    cache: "no-store",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
    ...(signal ? { signal } : {})
  };
}

async function readResponse(pending: Promise<Response>): Promise<Response> {
  try {
    return await pending;
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }

    throw new DashboardLoadError();
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new DashboardLoadError();
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
