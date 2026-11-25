import {
  integrationListResponseSchema,
  type IntegrationStatus,
  type IntegrationType
} from "@dashboard/contracts";

import type { CalendarConnectionStatus } from "../components/google-calendar-connect";

export async function loadGoogleCalendarStatus(
  origin: string,
  cookieHeader: string,
  fetchImpl: typeof fetch = fetch
): Promise<IntegrationStatus | null> {
  try {
    const headers = new Headers({ Accept: "application/json" });

    if (cookieHeader) {
      headers.set("Cookie", cookieHeader);
    }

    return await readCalendarStatus(
      fetchImpl(new URL("/api/v1/integrations", origin), {
        cache: "no-store",
        headers
      })
    );
  } catch {
    return null;
  }
}

export async function loadBrowserGoogleCalendarStatus(
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal
): Promise<IntegrationStatus | null> {
  try {
    return await readCalendarStatus(
      fetchImpl("/api/v1/integrations", {
        cache: "no-store",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
        ...(signal ? { signal } : {})
      })
    );
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }

    return null;
  }
}

export async function loadTelegramStatus(
  origin: string,
  cookieHeader: string,
  fetchImpl: typeof fetch = fetch
): Promise<IntegrationStatus | null> {
  try {
    const headers = new Headers({ Accept: "application/json" });

    if (cookieHeader) {
      headers.set("Cookie", cookieHeader);
    }

    return await readIntegrationStatus(
      fetchImpl(new URL("/api/v1/integrations", origin), {
        cache: "no-store",
        headers
      }),
      "telegram"
    );
  } catch {
    return null;
  }
}

export async function loadBrowserTelegramStatus(
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal
): Promise<IntegrationStatus | null> {
  try {
    return await readIntegrationStatus(
      fetchImpl("/api/v1/integrations", {
        cache: "no-store",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
        ...(signal ? { signal } : {})
      }),
      "telegram"
    );
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }

    return null;
  }
}

async function readCalendarStatus(pending: Promise<Response>): Promise<IntegrationStatus | null> {
  return readIntegrationStatus(pending, "google_calendar");
}

async function readIntegrationStatus(
  pending: Promise<Response>,
  type: IntegrationType
): Promise<IntegrationStatus | null> {
  const response = await pending;

  if (!response.ok) {
    return null;
  }

  const parsed = integrationListResponseSchema.safeParse(await response.json());

  if (!parsed.success) {
    return null;
  }

  return parsed.data.data.integrations.find((item) => item.type === type)?.status ?? "disconnected";
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export function calendarCardStatus(
  persisted: IntegrationStatus | null,
  flash: CalendarConnectionStatus | null
): CalendarConnectionStatus | null {
  if (persisted === "connected" || flash === "connected") {
    return "connected";
  }

  return flash;
}
