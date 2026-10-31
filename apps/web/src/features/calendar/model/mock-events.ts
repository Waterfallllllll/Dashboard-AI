import { TZDate } from "@date-fns/tz";

import { toZonedDate } from "@/lib/format/date-time";

import type { CalendarEvent } from "./calendar-types";

function startOfZonedDay(now: number, timeZone: string): number {
  const zoned = toZonedDate(now, timeZone);
  return new TZDate(zoned.getFullYear(), zoned.getMonth(), zoned.getDate(), 0, 0, timeZone).getTime();
}

export function createMockCalendarEvents(
  now = Date.now(),
  timeZone = "Europe/Moscow"
): readonly CalendarEvent[] {
  const dayStart = startOfZonedDay(now, timeZone);
  const dayEnd = dayStart + 24 * 60 * 60 * 1000 - 60_000;

  return [
    {
      id: "birthday",
      title: "День рождения Марии",
      startAt: dayStart,
      endAt: dayEnd,
      allDay: true,
      location: null,
      meetingUrl: null,
      htmlLink: "https://calendar.google.com/calendar/event?eid=mock-birthday",
      status: "confirmed",
      calendar: { name: "Личное", color: "#8a5a00" }
    },
    {
      id: "run",
      title: "Утренняя пробежка",
      startAt: now - 3 * 60 * 60 * 1000,
      endAt: now - 2 * 60 * 60 * 1000 - 20 * 60 * 1000,
      allDay: false,
      location: "Парк",
      meetingUrl: null,
      htmlLink: "https://calendar.google.com/calendar/event?eid=mock-run",
      status: "confirmed",
      calendar: { name: "Личное", color: "#8a5a00" }
    },
    {
      id: "standup",
      title: "Стендап команды",
      startAt: now + 20 * 60 * 1000,
      endAt: now + 40 * 60 * 1000,
      allDay: false,
      location: null,
      meetingUrl: "https://meet.google.com/abc-defg-hij",
      htmlLink: "https://calendar.google.com/calendar/event?eid=mock-standup",
      status: "confirmed",
      calendar: { name: "Работа", color: "#0f7a4f" }
    },
    {
      id: "review",
      title: "Разбор макетов",
      startAt: now + 2 * 60 * 60 * 1000,
      endAt: now + 3 * 60 * 60 * 1000,
      allDay: false,
      location: "Переговорка 3",
      meetingUrl: "https://meet.google.com/xyz-review",
      htmlLink: "https://calendar.google.com/calendar/event?eid=mock-review",
      status: "tentative",
      calendar: { name: "Работа", color: "#0f7a4f" }
    },
    {
      id: "one-on-one",
      title: "1:1 с руководителем",
      startAt: now + 5 * 60 * 60 * 1000,
      endAt: now + 5 * 60 * 60 * 1000 + 30 * 60 * 1000,
      allDay: false,
      location: null,
      meetingUrl: "https://meet.google.com/one-on-one",
      htmlLink: "https://calendar.google.com/calendar/event?eid=mock-1-1",
      status: "confirmed",
      calendar: { name: "Работа", color: "#0f7a4f" }
    }
  ];
}

export const MOCK_CALENDAR_UPDATED_AT_OFFSET_MS = 6 * 60 * 1000;
