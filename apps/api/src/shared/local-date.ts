const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function addDays(isoDate: string, days: number): string {
  const parts = readIsoDate(isoDate);
  const utc = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return utc.toISOString().slice(0, 10);
}

export function weekday(isoDate: string): number {
  const parts = readIsoDate(isoDate);
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
}

export function localDateInTimeZone(now: Date, timeZone: string): string {
  const parts = zonedParts(now, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function zonedDayBounds(isoDate: string, timeZone: string): { from: Date; to: Date } {
  return {
    from: zonedDateTimeToUtc(isoDate, "00:00:00", timeZone),
    to: zonedDateTimeToUtc(addDays(isoDate, 1), "00:00:00", timeZone)
  };
}

function zonedDateTimeToUtc(isoDate: string, time: string, timeZone: string): Date {
  const guess = new Date(`${isoDate}T${time}.000Z`);
  const corrected = new Date(guess.getTime() - offsetMs(guess, timeZone));
  return new Date(guess.getTime() - offsetMs(corrected, timeZone));
}

function offsetMs(instant: Date, timeZone: string): number {
  const parts = zonedParts(instant, timeZone);
  const zonedAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return zonedAsUtc - instant.getTime();
}

function zonedParts(
  instant: Date,
  timeZone: string
): {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;

  const year = read("year");
  const month = read("month");
  const day = read("day");
  const minute = read("minute");
  const second = read("second");
  let hour = read("hour");

  if (!year || !month || !day || !hour || !minute || !second) {
    throw new Error("Не удалось определить локальную дату");
  }

  if (hour === "24") {
    hour = "00";
  }

  return { year, month, day, hour, minute, second };
}

function readIsoDate(isoDate: string): { year: number; month: number; day: number } {
  const match = ISO_DATE.exec(isoDate);

  if (!match) {
    throw new Error("Некорректная дата");
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3])
  };
}
