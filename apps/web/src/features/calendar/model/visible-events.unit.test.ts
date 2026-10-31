import { describe, expect, it } from "vitest";

import type { CalendarEvent } from "./calendar-types";
import { getNextEvent, getVisibleEvents } from "./visible-events";

function event(overrides: Partial<CalendarEvent> & Pick<CalendarEvent, "id" | "startAt" | "endAt">): CalendarEvent {
  return {
    title: overrides.id,
    allDay: false,
    location: null,
    meetingUrl: null,
    htmlLink: "https://calendar.google.com",
    status: "confirmed",
    calendar: { name: "Работа", color: "#0f7a4f" },
    ...overrides
  };
}

describe("visible calendar events", () => {
  const now = 1_000;

  it("скрывает завершившиеся и поднимает события на весь день", () => {
    const events = [
      event({ id: "past", startAt: 0, endAt: 500 }),
      event({ id: "soon", startAt: 1_500, endAt: 2_000 }),
      event({ id: "all-day", startAt: 0, endAt: 3_000, allDay: true, title: "Весь день" })
    ];

    expect(getVisibleEvents(events, now).map((item) => item.id)).toEqual(["all-day", "soon"]);
  });

  it("выбирает ближайшее интервальное событие", () => {
    const events = [
      event({ id: "all-day", startAt: 0, endAt: 3_000, allDay: true }),
      event({ id: "next", startAt: 1_200, endAt: 1_800 })
    ];

    expect(getNextEvent(events, now)?.id).toBe("next");
  });
});
