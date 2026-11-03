import type { CalendarEvent } from "./calendar-types";

export function getVisibleEvents(
  events: readonly CalendarEvent[],
  now: number,
  hideFinished = true
): CalendarEvent[] {
  return events
    .filter((event) => !hideFinished || event.endAt > now)
    .slice()
    .sort((left, right) => {
      if (left.allDay !== right.allDay) {
        return left.allDay ? -1 : 1;
      }

      return left.startAt - right.startAt;
    });
}

export function presentCalendarEvents(
  events: readonly CalendarEvent[],
  options: Readonly<{ itemLimit?: number; calendarScope?: "all" | "work" }> = {}
): CalendarEvent[] {
  const scoped =
    options.calendarScope === "work"
      ? events.filter((event) => event.calendar.name === "Работа")
      : [...events];

  return typeof options.itemLimit === "number" ? scoped.slice(0, options.itemLimit) : scoped;
}

export function getNextEvent(events: readonly CalendarEvent[], now: number): CalendarEvent | null {
  return (
    getVisibleEvents(events, now).find((event) => !event.allDay && event.startAt >= now) ??
    getVisibleEvents(events, now).find((event) => !event.allDay && event.endAt > now) ??
    null
  );
}
