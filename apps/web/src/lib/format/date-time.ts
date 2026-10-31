import { TZDate } from "@date-fns/tz";
import { format, isSameDay } from "date-fns";
import { ru } from "date-fns/locale";

export function getSystemTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function toZonedDate(now: number | Date, timeZone: string): TZDate {
  const timestamp = now instanceof Date ? now.getTime() : now;
  const zoned = new TZDate(timestamp, timeZone);

  if (Number.isNaN(zoned.getTime())) {
    return new TZDate(timestamp, getSystemTimeZone());
  }

  return zoned;
}

export function formatInZone(now: number | Date, timeZone: string, pattern: string): string {
  return format(toZonedDate(now, timeZone), pattern, { locale: ru });
}

export function formatUpdatedAt(updatedAt: number, now: number, timeZone: string): string {
  const zonedUpdated = toZonedDate(updatedAt, timeZone);
  const time = format(zonedUpdated, "HH:mm", { locale: ru });

  if (isSameDay(zonedUpdated, toZonedDate(now, timeZone))) {
    return `сегодня в ${time}`;
  }

  return `${format(zonedUpdated, "d MMM", { locale: ru })} в ${time}`;
}
