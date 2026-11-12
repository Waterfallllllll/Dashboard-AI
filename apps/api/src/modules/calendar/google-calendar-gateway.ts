import { google, type calendar_v3 } from "googleapis";

import { ProviderUnavailableError } from "../../infrastructure/http/provider-guard.js";
import {
  CalendarAccessRevokedError,
  CalendarSyncResetError,
  type RawCalendarEvent
} from "./calendar-model.js";

export type CalendarCredentials = {
  readonly accessToken: string;
  readonly refreshToken: string | null;
  readonly expiresAt: Date | null;
};

export type CalendarPageQuery = {
  readonly syncToken: string | null;
  readonly timeMin: string | null;
  readonly timeMax: string | null;
  readonly pageToken: string | null;
};

export type CalendarPage = {
  readonly events: readonly RawCalendarEvent[];
  readonly nextPageToken: string | null;
  readonly nextSyncToken: string | null;
  readonly accessToken: string | null;
};

export type CalendarGateway = {
  listEvents(credentials: CalendarCredentials, query: CalendarPageQuery): Promise<CalendarPage>;
};

export type CalendarWatch = {
  readonly channelId: string;
  readonly resourceId: string;
  readonly expiresAt: Date;
};

export type CalendarWatchGateway = {
  watch(
    credentials: CalendarCredentials,
    input: {
      readonly channelId: string;
      readonly address: string;
      readonly token: string;
      readonly expiresAt: Date;
    }
  ): Promise<CalendarWatch>;
  stop(credentials: CalendarCredentials, channelId: string, resourceId: string): Promise<void>;
};

export function createGoogleCalendarGateway(
  clientId: string,
  clientSecret: string
): CalendarGateway & CalendarWatchGateway {
  return {
    async listEvents(credentials, query) {
      const { calendar, auth } = calendarClient(clientId, clientSecret, credentials);
      const params: calendar_v3.Params$Resource$Events$List = {
        calendarId: "primary",
        maxResults: 50
      };

      if (query.syncToken) {
        params.syncToken = query.syncToken;
        params.showDeleted = true;
      } else {
        params.singleEvents = true;
        params.orderBy = "startTime";

        if (query.timeMin) {
          params.timeMin = query.timeMin;
        }

        if (query.timeMax) {
          params.timeMax = query.timeMax;
        }
      }

      if (query.pageToken) {
        params.pageToken = query.pageToken;
      }

      try {
        const response = await calendar.events.list(params, { timeout: 3000 });
        const refreshed = auth.credentials.access_token;

        return {
          events: (response.data.items ?? []).map(toRaw),
          nextPageToken: response.data.nextPageToken ?? null,
          nextSyncToken: response.data.nextSyncToken ?? null,
          accessToken:
            typeof refreshed === "string" && refreshed !== credentials.accessToken
              ? refreshed
              : null
        };
      } catch (error) {
        const status = statusOf(error);

        if (status === 410) {
          throw new CalendarSyncResetError();
        }

        if (status === 401 || status === 403) {
          throw new CalendarAccessRevokedError();
        }

        throw new ProviderUnavailableError("google-calendar");
      }
    },
    async watch(credentials, input) {
      const { calendar } = calendarClient(clientId, clientSecret, credentials);

      try {
        const response = await calendar.events.watch(
          {
            calendarId: "primary",
            requestBody: {
              id: input.channelId,
              type: "web_hook",
              address: input.address,
              token: input.token,
              expiration: String(input.expiresAt.getTime())
            }
          },
          { timeout: 3000 }
        );
        const resourceId = response.data.resourceId;

        if (!resourceId) {
          throw new ProviderUnavailableError("google-calendar");
        }

        const expiration = Number(response.data.expiration ?? input.expiresAt.getTime());
        return {
          channelId: input.channelId,
          resourceId,
          expiresAt: new Date(Number.isFinite(expiration) ? expiration : input.expiresAt.getTime())
        };
      } catch (error) {
        if (error instanceof ProviderUnavailableError) {
          throw error;
        }

        const status = statusOf(error);

        if (status === 401 || status === 403) {
          throw new CalendarAccessRevokedError();
        }

        throw new ProviderUnavailableError("google-calendar");
      }
    },
    async stop(credentials, channelId, resourceId) {
      const { calendar } = calendarClient(clientId, clientSecret, credentials);

      try {
        await calendar.channels.stop(
          { requestBody: { id: channelId, resourceId } },
          { timeout: 3000 }
        );
      } catch (error) {
        const status = statusOf(error);

        if (status === 404) {
          return;
        }

        throw new ProviderUnavailableError("google-calendar");
      }
    }
  };
}

function calendarClient(clientId: string, clientSecret: string, credentials: CalendarCredentials) {
  const auth = new google.auth.OAuth2(clientId, clientSecret);
  const tokens: { access_token: string; refresh_token?: string; expiry_date?: number } = {
    access_token: credentials.accessToken
  };

  if (credentials.refreshToken) {
    tokens.refresh_token = credentials.refreshToken;
  }

  if (credentials.expiresAt) {
    tokens.expiry_date = credentials.expiresAt.getTime();
  }

  auth.setCredentials(tokens);
  return { auth, calendar: google.calendar({ version: "v3", auth }) };
}

function toRaw(event: calendar_v3.Schema$Event): RawCalendarEvent {
  return {
    id: event.id ?? "",
    status: event.status ?? "",
    summary: event.summary ?? "",
    htmlLink: event.htmlLink ?? "",
    location: event.location ?? "",
    hangoutLink: event.hangoutLink ?? "",
    meetingUrl: meetingUrl(event),
    startDate: event.start?.date ?? "",
    startDateTime: event.start?.dateTime ?? "",
    endDate: event.end?.date ?? "",
    endDateTime: event.end?.dateTime ?? ""
  };
}

function meetingUrl(event: calendar_v3.Schema$Event): string {
  const entry = event.conferenceData?.entryPoints?.find(
    (point) => point.entryPointType === "video" && typeof point.uri === "string"
  );
  return entry?.uri ?? "";
}

function statusOf(error: unknown): number | null {
  if (typeof error !== "object" || error === null) {
    return null;
  }

  if (
    "response" in error &&
    typeof error.response === "object" &&
    error.response &&
    "status" in error.response
  ) {
    return typeof error.response.status === "number" ? error.response.status : null;
  }

  if ("code" in error && typeof error.code === "number") {
    return error.code;
  }

  return null;
}
