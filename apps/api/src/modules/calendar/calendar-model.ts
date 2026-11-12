import { isHttpsUrl } from "@dashboard/contracts";

import { addDays, zonedDayBounds } from "../../shared/local-date.js";

const CALENDAR_HOSTS = new Set(["www.google.com", "calendar.google.com"]);

export type RawCalendarEvent = {
  readonly id: string;
  readonly status: string;
  readonly summary: string;
  readonly htmlLink: string;
  readonly location: string;
  readonly hangoutLink: string;
  readonly meetingUrl: string;
  readonly startDate: string;
  readonly startDateTime: string;
  readonly endDate: string;
  readonly endDateTime: string;
};

export type NormalizedEvent = {
  readonly externalEventId: string;
  readonly title: string;
  readonly startAt: Date;
  readonly endAt: Date;
  readonly allDay: boolean;
  readonly location: string | null;
  readonly meetingUrl: string | null;
  readonly htmlLink: string;
  readonly status: "confirmed" | "tentative";
};

export type CalendarChange =
  | { readonly kind: "upsert"; readonly event: NormalizedEvent }
  | { readonly kind: "delete"; readonly externalEventId: string };

export function normalizeCalendarEvent(
  raw: RawCalendarEvent,
  timeZone: string
): CalendarChange | null {
  if (raw.id.length === 0 || raw.id.length > 1024) {
    return null;
  }

  if (raw.status === "cancelled") {
    return { kind: "delete", externalEventId: raw.id };
  }

  const htmlLink = calendarLink(raw.htmlLink);

  if (!htmlLink) {
    return null;
  }

  const timed = instantRange(raw, timeZone);

  if (!timed) {
    return null;
  }

  return {
    kind: "upsert",
    event: {
      externalEventId: raw.id,
      title: clip(raw.summary.length > 0 ? raw.summary : "Без названия", 300),
      startAt: timed.startAt,
      endAt: timed.endAt,
      allDay: timed.allDay,
      location: optionalText(raw.location, 300),
      meetingUrl: httpsOrNull(raw.meetingUrl || raw.hangoutLink),
      htmlLink,
      status: raw.status === "tentative" ? "tentative" : "confirmed"
    }
  };
}

export class CalendarSyncResetError extends Error {
  constructor() {
    super("Календарь нужно синхронизировать заново");
    this.name = "CalendarSyncResetError";
  }
}

export class CalendarAccessRevokedError extends Error {
  constructor() {
    super("Доступ к календарю отозван");
    this.name = "CalendarAccessRevokedError";
  }
}

function instantRange(
  raw: RawCalendarEvent,
  timeZone: string
): { startAt: Date; endAt: Date; allDay: boolean } | null {
  if (raw.startDateTime.length > 0) {
    const startAt = new Date(raw.startDateTime);
    const endAt =
      raw.endDateTime.length > 0
        ? new Date(raw.endDateTime)
        : new Date(startAt.getTime() + 30 * 60 * 1000);

    if (
      Number.isNaN(startAt.getTime()) ||
      Number.isNaN(endAt.getTime()) ||
      endAt.getTime() < startAt.getTime()
    ) {
      return null;
    }

    return { startAt, endAt, allDay: false };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw.startDate)) {
    return null;
  }

  const endDate = /^\d{4}-\d{2}-\d{2}$/.test(raw.endDate) ? raw.endDate : addDays(raw.startDate, 1);

  try {
    return {
      startAt: zonedDayBounds(raw.startDate, timeZone).from,
      endAt: zonedDayBounds(endDate, timeZone).from,
      allDay: true
    };
  } catch {
    return null;
  }
}

function calendarLink(value: string): string | null {
  if (!isHttpsUrl(value)) {
    return null;
  }

  try {
    const url = new URL(value);
    return CALENDAR_HOSTS.has(url.hostname) ? url.toString() : null;
  } catch {
    return null;
  }
}

function httpsOrNull(value: string): string | null {
  return value.length > 0 && isHttpsUrl(value) ? value : null;
}

function optionalText(value: string, max: number): string | null {
  const text = clip(value, max);
  return text.length > 0 ? text : null;
}

function clip(value: string, max: number): string {
  return value.replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
}
