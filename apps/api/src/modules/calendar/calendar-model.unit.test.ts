import { describe, expect, it } from "vitest";

import { normalizeCalendarEvent, type RawCalendarEvent } from "./calendar-model.js";

describe("нормализация события календаря", () => {
  it("оставляет подтверждённую встречу и удаляет отменённую", () => {
    const event = normalizeCalendarEvent(raw("confirmed"), "Europe/Moscow");
    expect(event?.kind).toBe("upsert");

    if (event?.kind === "upsert") {
      expect(event.event.title).toBe("План");
      expect(event.event.htmlLink.startsWith("https://calendar.google.com/")).toBe(true);
      expect(event.event.meetingUrl).toBe("https://meet.google.com/abc-defg-hij");
    }

    expect(normalizeCalendarEvent(raw("cancelled"), "Europe/Moscow")).toEqual({
      kind: "delete",
      externalEventId: "evt-1"
    });
    expect(
      normalizeCalendarEvent(
        { ...raw("confirmed"), htmlLink: "https://evil.test/event" },
        "Europe/Moscow"
      )
    ).toBeNull();
  });
});

function raw(status: string): RawCalendarEvent {
  return {
    id: "evt-1",
    status,
    summary: "План",
    htmlLink: "https://calendar.google.com/calendar/event?eid=evt",
    location: "Офис",
    hangoutLink: "",
    meetingUrl: "https://meet.google.com/abc-defg-hij",
    startDate: "",
    startDateTime: "2026-11-12T09:00:00+03:00",
    endDate: "",
    endDateTime: "2026-11-12T10:00:00+03:00"
  };
}
