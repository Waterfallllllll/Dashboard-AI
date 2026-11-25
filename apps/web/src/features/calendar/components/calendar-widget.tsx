"use client";

import { ExternalLink, Video } from "lucide-react";
import { useState } from "react";

import { formatInZone } from "@/lib/format/date-time";

import type { CalendarEvent } from "../model/calendar-types";
import { createMockCalendarEvents } from "../model/mock-events";
import { getNextEvent, getVisibleEvents, presentCalendarEvents } from "../model/visible-events";

import styles from "./calendar-widget.module.scss";

type CalendarWidgetProps = Readonly<{
  calendarScope?: "all" | "work";
  events?: readonly CalendarEvent[];
  itemLimit?: number;
  now?: number;
  timeZone: string;
}>;

export function CalendarWidget({
  calendarScope,
  events: eventsProp,
  itemLimit,
  now: nowProp,
  timeZone
}: CalendarWidgetProps) {
  const [capturedNow] = useState(() => nowProp ?? Date.now());
  const now = nowProp ?? capturedNow;
  const events = presentCalendarEvents(
    getVisibleEvents(eventsProp ?? createMockCalendarEvents(now, timeZone), now),
    {
      ...(calendarScope !== undefined ? { calendarScope } : {}),
      ...(itemLimit !== undefined ? { itemLimit } : {})
    }
  );
  const nextEvent = getNextEvent(events, now);

  if (events.length === 0) {
    return <p className={styles.empty}>На сегодня событий нет.</p>;
  }

  return (
    <ol className={styles.list}>
      {events.map((event) => {
        const isNext = nextEvent?.id === event.id;

        return (
          <li className={styles.item} data-next={isNext ? "true" : "false"} key={event.id}>
            <span
              aria-hidden="true"
              className={styles.marker}
              style={{ background: event.calendar.color }}
            />
            <div className={styles.time}>
              {event.allDay ? "Весь день" : formatInZone(event.startAt, timeZone, "HH:mm")}
            </div>
            <div className={styles.body}>
              <p className={styles.title}>
                {event.title}
                {isNext ? <span className={styles.next}>Ближайшее</span> : null}
              </p>
              <p className={styles.meta}>
                {event.calendar.name}
                {event.status === "tentative" ? " · предварительно" : ""}
                {event.location ? ` · ${event.location}` : ""}
              </p>
              <div className={styles.actions}>
                {event.meetingUrl ? (
                  <a
                    className={styles.link}
                    href={event.meetingUrl}
                    rel="noreferrer noopener"
                    target="_blank"
                  >
                    <Video aria-hidden="true" strokeWidth={1.8} />
                    Встреча
                  </a>
                ) : null}
                <a
                  className={styles.link}
                  href={event.htmlLink}
                  rel="noreferrer noopener"
                  target="_blank"
                >
                  <ExternalLink aria-hidden="true" strokeWidth={1.8} />
                  Календарь
                </a>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
