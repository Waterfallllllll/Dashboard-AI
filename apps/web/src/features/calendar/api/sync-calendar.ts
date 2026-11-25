import {
  CSRF_HEADER,
  apiSuccessSchema,
  calendarSectionSchema,
  localDateSchema,
  sessionResponseSchema,
  type CalendarSection
} from "@dashboard/contracts";

const calendarSectionResponseSchema = apiSuccessSchema(calendarSectionSchema);

export type CalendarSyncCode = "unauthenticated" | "missing" | "unavailable";

export class CalendarSyncError extends Error {
  readonly code: CalendarSyncCode;

  constructor(code: CalendarSyncCode) {
    super(messageFor(code));
    this.name = "CalendarSyncError";
    this.code = code;
  }
}

export async function syncCalendar(
  date: string,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal
): Promise<CalendarSection> {
  if (!localDateSchema.safeParse(date).success) {
    throw new CalendarSyncError("unavailable");
  }

  try {
    const sessionResponse = await fetchImpl("/api/v1/auth/session", requestInit(signal));

    if (sessionResponse.status === 401) {
      throw new CalendarSyncError("unauthenticated");
    }

    if (!sessionResponse.ok) {
      throw new CalendarSyncError("unavailable");
    }

    const session = sessionResponseSchema.safeParse(await readJson(sessionResponse));

    if (!session.success) {
      throw new CalendarSyncError("unavailable");
    }

    const response = await fetchImpl(
      `/api/v1/calendar/sync?date=${encodeURIComponent(date)}`,
      {
        ...requestInit(signal),
        method: "POST",
        headers: {
          Accept: "application/json",
          [CSRF_HEADER]: session.data.data.csrfToken
        }
      }
    );

    if (response.status === 401) {
      throw new CalendarSyncError("unauthenticated");
    }

    if (response.status === 404) {
      throw new CalendarSyncError("missing");
    }

    if (!response.ok) {
      throw new CalendarSyncError("unavailable");
    }

    const parsed = calendarSectionResponseSchema.safeParse(await readJson(response));

    if (!parsed.success) {
      throw new CalendarSyncError("unavailable");
    }

    return parsed.data.data;
  } catch (error) {
    if (error instanceof CalendarSyncError || isAbortError(error)) {
      throw error;
    }

    throw new CalendarSyncError("unavailable");
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

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }

    throw new CalendarSyncError("unavailable");
  }
}

function messageFor(code: CalendarSyncCode): string {
  switch (code) {
    case "unauthenticated":
      return "Сначала войдите через Google";
    case "missing":
      return "Календарь не подключён";
    case "unavailable":
      return "Не удалось обновить календарь";
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
