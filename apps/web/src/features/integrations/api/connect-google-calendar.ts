import {
  CSRF_HEADER,
  googleConnectResponseSchema,
  sessionResponseSchema
} from "@dashboard/contracts";

const GOOGLE_AUTHORIZATION_HOST = "accounts.google.com";

export type CalendarConnectCode = "unauthenticated" | "unavailable";

export class CalendarConnectError extends Error {
  readonly code: CalendarConnectCode;

  constructor(code: CalendarConnectCode) {
    super(
      code === "unauthenticated"
        ? "Сначала войдите через Google"
        : "Не удалось подключить календарь"
    );
    this.name = "CalendarConnectError";
    this.code = code;
  }
}

export async function connectGoogleCalendar(fetchImpl: typeof fetch = fetch): Promise<string> {
  const sessionResponse = await fetchImpl("/api/v1/auth/session", {
    credentials: "same-origin",
    headers: { Accept: "application/json" }
  });

  if (sessionResponse.status === 401) {
    throw new CalendarConnectError("unauthenticated");
  }

  if (!sessionResponse.ok) {
    throw new CalendarConnectError("unavailable");
  }

  const session = sessionResponseSchema.parse(await readJson(sessionResponse));
  const response = await fetchImpl("/api/v1/integrations/google/connect", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      [CSRF_HEADER]: session.data.csrfToken
    }
  });

  if (!response.ok) {
    throw new CalendarConnectError(response.status === 401 ? "unauthenticated" : "unavailable");
  }

  const body = googleConnectResponseSchema.parse(await readJson(response));
  const url = new URL(body.data.url);

  if (url.protocol !== "https:" || url.hostname !== GOOGLE_AUTHORIZATION_HOST) {
    throw new CalendarConnectError("unavailable");
  }

  return url.href;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new CalendarConnectError("unavailable");
  }
}
