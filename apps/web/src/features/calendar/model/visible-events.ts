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

export function getNextEvent(
  events: readonly CalendarEvent[],
  now: number
): CalendarEvent | null {
  return (
    getVisibleEvents(events, now).find((event) => !event.allDay && event.startAt >= now) ??
    getVisibleEvents(events, now).find((event) => !event.allDay && event.endAt > now) ??
    null
  );
}
