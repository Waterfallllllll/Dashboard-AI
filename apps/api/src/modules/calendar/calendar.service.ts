import { createHash } from "node:crypto";

import { API_ERROR_CODES, SECTION_ERROR_MESSAGE } from "@dashboard/contracts";
import type { CalendarEvent, CalendarSection } from "@dashboard/contracts";

import { ProviderUnavailableError } from "../../infrastructure/http/provider-guard.js";
import { ApiError } from "../../shared/errors/api-error.js";
import type { Viewer } from "../../shared/http/require-actor.js";
import { addDays, localDateInTimeZone, zonedDayBounds } from "../../shared/local-date.js";
import type { JobScheduler } from "../timers/timer-jobs.js";
import type { Actor } from "../auth/auth.types.js";
import {
  CalendarAccessRevokedError,
  CalendarSyncResetError,
  normalizeCalendarEvent,
  type NormalizedEvent
} from "./calendar-model.js";
import type { CalendarRepository, StoredCalendarEvent } from "./calendar.repository.js";
import type { CalendarGateway, CalendarPage } from "./google-calendar-gateway.js";

const FRESH_MS = 30 * 60 * 1000;
const MAX_PAGES = 3;

export type CalendarAccess = {
  readonly integrationId: string;
  readonly status: "connected" | "revoked";
  readonly lastSyncAt: Date | null;
  readonly syncCursor: string | null;
  readonly accessToken: string | null;
  readonly refreshToken: string | null;
  readonly expiresAt: Date | null;
};

export type CalendarIntegrationPort = {
  state(userId: string): Promise<CalendarAccess | null>;
  saveSync(
    userId: string,
    cursor: string | null,
    accessToken: string | null,
    now: Date
  ): Promise<void>;
  markRevoked(userId: string, now: Date): Promise<void>;
};

export type CalendarLimitPort = {
  limit(actor: Actor): Promise<number>;
};

export class CalendarService {
  constructor(
    private readonly events: CalendarRepository,
    private readonly integrations: CalendarIntegrationPort,
    private readonly gateway: CalendarGateway,
    private readonly limits: CalendarLimitPort,
    private readonly now: () => Date = () => new Date()
  ) {}

  async load(viewer: Viewer, date: string): Promise<CalendarSection> {
    try {
      const access = await this.integrations.state(viewer.userId);

      if (!access || access.status !== "connected") {
        return { status: "unavailable" };
      }

      const bounds = zonedDayBounds(date, viewer.timezone);
      const limit = await this.limits.limit(viewer);
      const visible = (await this.events.listRange(viewer.userId, bounds.from, bounds.to))
        .filter((event) => event.allDay || event.endAt.getTime() > this.now().getTime())
        .slice(0, limit)
        .flatMap((event) => {
          const dto = toDto(event);
          return dto ? [dto] : [];
        });

      if (visible.length === 0) {
        return { status: "empty" };
      }

      const updatedAt = (access.lastSyncAt ?? this.now()).toISOString();
      const stale =
        access.lastSyncAt === null || this.now().getTime() - access.lastSyncAt.getTime() > FRESH_MS;

      return stale
        ? { status: "stale", updatedAt, events: visible }
        : { status: "ready", updatedAt, events: visible };
    } catch {
      return { status: "error", message: SECTION_ERROR_MESSAGE };
    }
  }

  async sync(viewer: Viewer, date: string): Promise<CalendarSection> {
    const access = await this.integrations.state(viewer.userId);

    if (!access || access.status !== "connected" || !access.accessToken) {
      throw new ApiError({ code: API_ERROR_CODES.notFound });
    }

    try {
      if (access.syncCursor) {
        try {
          await this.incremental(viewer, access);
        } catch (error) {
          if (!(error instanceof CalendarSyncResetError)) {
            throw error;
          }

          await this.integrations.saveSync(viewer.userId, null, null, this.now());
          await this.window(viewer, date, { ...access, syncCursor: null });
        }
      } else {
        await this.window(viewer, date, access);
      }
    } catch (error) {
      if (error instanceof CalendarAccessRevokedError) {
        await this.integrations.markRevoked(viewer.userId, this.now());
      }

      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError({ code: API_ERROR_CODES.unavailable });
    }

    return this.load(viewer, date);
  }

  async deleteForUser(userId: string): Promise<void> {
    await this.events.deleteForUser(userId);
  }

  private async window(viewer: Viewer, date: string, access: CalendarAccess): Promise<void> {
    const from = zonedDayBounds(date, viewer.timezone).from;
    const to = zonedDayBounds(addDays(date, 2), viewer.timezone).from;
    const collected: NormalizedEvent[] = [];
    let pageToken: string | null = null;
    let refreshed: string | null = null;

    for (let page = 0; page < MAX_PAGES; page += 1) {
      const result = await this.page(access, {
        syncToken: null,
        timeMin: from.toISOString(),
        timeMax: to.toISOString(),
        pageToken
      });
      refreshed = result.accessToken ?? refreshed;
      collected.push(
        ...changes(result, viewer.timezone).flatMap((change) =>
          change.kind === "upsert" ? [change.event] : []
        )
      );
      pageToken = result.nextPageToken;

      if (!pageToken) {
        break;
      }
    }

    await this.events.replaceWindow(
      viewer.userId,
      access.integrationId,
      collected,
      from,
      to,
      this.now()
    );
    await this.integrations.saveSync(viewer.userId, null, refreshed, this.now());
  }

  private async incremental(viewer: Viewer, access: CalendarAccess): Promise<void> {
    const upserts: NormalizedEvent[] = [];
    const deleted: string[] = [];
    let pageToken: string | null = null;
    let nextCursor: string | null = null;
    let refreshed: string | null = null;

    for (let page = 0; page < MAX_PAGES; page += 1) {
      const result = await this.page(access, {
        syncToken: access.syncCursor,
        timeMin: null,
        timeMax: null,
        pageToken
      });
      refreshed = result.accessToken ?? refreshed;

      for (const change of changes(result, viewer.timezone)) {
        if (change.kind === "delete") {
          deleted.push(change.externalEventId);
        } else {
          upserts.push(change.event);
        }
      }

      if (result.nextSyncToken) {
        nextCursor = result.nextSyncToken;
      }

      pageToken = result.nextPageToken;

      if (!pageToken) {
        break;
      }
    }

    await this.events.apply(viewer.userId, access.integrationId, upserts, deleted, this.now());
    await this.integrations.saveSync(
      viewer.userId,
      nextCursor && nextCursor.length <= 2048 ? nextCursor : access.syncCursor,
      refreshed,
      this.now()
    );
  }

  async enqueueUpcomingReminders(
    userId: string,
    timeZone: string,
    jobs: JobScheduler,
    maxAttempts: number
  ): Promise<void> {
    const today = localDateInTimeZone(this.now(), timeZone);
    const bounds = zonedDayBounds(today, timeZone);
    const events = await this.events.listRange(userId, bounds.from, bounds.to);

    for (const event of events) {
      if (event.allDay || event.userId !== userId) {
        continue;
      }

      const lead = event.startAt.getTime() - this.now().getTime();

      if (lead < 0 || lead > 15 * 60_000) {
        continue;
      }

      const eventKey = createHash("sha256")
        .update(event.externalEventId)
        .digest("hex")
        .slice(0, 32);

      for (const channel of ["browser", "telegram", "in_app"] as const) {
        await jobs.schedule({
          type: "deliver-notification",
          payload: { eventType: "calendar", channel, title: event.title.slice(0, 120) },
          runAt: this.now(),
          idempotencyKey: `calendar:${eventKey}:${today}:reminder:${channel}`,
          userId,
          maxAttempts
        });
      }
    }
  }

  private async page(
    access: CalendarAccess,
    query: {
      readonly syncToken: string | null;
      readonly timeMin: string | null;
      readonly timeMax: string | null;
      readonly pageToken: string | null;
    }
  ): Promise<CalendarPage> {
    if (!access.accessToken) {
      throw new CalendarAccessRevokedError();
    }

    try {
      return await this.gateway.listEvents(
        {
          accessToken: access.accessToken,
          refreshToken: access.refreshToken,
          expiresAt: access.expiresAt
        },
        query
      );
    } catch (error) {
      if (
        error instanceof CalendarSyncResetError ||
        error instanceof CalendarAccessRevokedError ||
        error instanceof ProviderUnavailableError
      ) {
        throw error;
      }

      throw new ProviderUnavailableError("google-calendar");
    }
  }
}

function changes(page: CalendarPage, timeZone: string) {
  return page.events.flatMap((event) => {
    const change = normalizeCalendarEvent(event, timeZone);
    return change ? [change] : [];
  });
}

function toDto(event: StoredCalendarEvent): CalendarEvent | null {
  const topic = event.status;

  if (topic !== "confirmed" && topic !== "tentative") {
    return null;
  }

  return {
    id: event.id,
    title: event.title,
    startAt: event.startAt.toISOString(),
    endAt: event.endAt.toISOString(),
    allDay: event.allDay,
    location: event.location,
    meetingUrl: event.meetingUrl,
    htmlLink: event.htmlLink,
    status: topic,
    calendarName: event.calendarName
  };
}
