import { TZDate } from "@date-fns/tz";
import { format, isSameDay } from "date-fns";
import { ru } from "date-fns/locale";

export function getSystemTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function localDateInTimeZone(timeZone: string, now = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(now);
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;

    if (year && month && day) {
      return `${year}-${month}-${day}`;
    }
  } catch {
    // An unknown zone falls back to the UTC calendar date.
  }

  return now.toISOString().slice(0, 10);
}

export function shiftLocalDate(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, (day ?? 1) + days));
  return shifted.toISOString().slice(0, 10);
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
