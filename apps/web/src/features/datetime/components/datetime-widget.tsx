"use client";

import { useTickingNow } from "@/lib/browser/use-ticking-now";
import { getSystemTimeZone } from "@/lib/format/date-time";

import { CLOCK_SKEW_NOTICE, getMockServerNow, hasClockSkew } from "../model/clock-skew";
import { formatClock, type ClockFormat } from "../model/format-clock";

import styles from "./datetime-widget.module.scss";

type DateTimeWidgetProps = Readonly<{
  timeFormat: ClockFormat;
  timeZone: string;
  systemTimeZone?: string;
  now?: number;
  serverNow?: number;
}>;

export function DateTimeWidget({
  now: nowProp,
  serverNow,
  systemTimeZone = getSystemTimeZone(),
  timeFormat,
  timeZone
}: DateTimeWidgetProps) {
  const liveNow = useTickingNow(nowProp === undefined);
  const now = nowProp ?? liveNow;
  const clock = formatClock({
    now,
    timeFormat,
    timeZone,
    systemTimeZone
  });
  const skewed = hasClockSkew(now, serverNow ?? getMockServerNow(now));

  return (
    <div className={styles.widget}>
      <p className={styles.time} suppressHydrationWarning>
        {clock.time}
      </p>
      <p className={styles.date} suppressHydrationWarning>
        {clock.date}
      </p>
      {clock.showTimeZone ? (
        <p className={styles.zone} suppressHydrationWarning>
          {clock.timeZoneLabel}
        </p>
      ) : null}
      {skewed ? (
        <p className={styles.skew} role="status">
          {CLOCK_SKEW_NOTICE}
        </p>
      ) : null}
    </div>
  );
}
