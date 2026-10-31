import { formatInZone, toZonedDate } from "@/lib/format/date-time";

const TIMEZONE_LABELS: Readonly<Record<string, string>> = {
  "Europe/Kaliningrad": "Калининград",
  "Europe/Moscow": "Москва",
  "Europe/Samara": "Самара",
  "Asia/Yekaterinburg": "Екатеринбург",
  "Asia/Novosibirsk": "Новосибирск",
  "Asia/Vladivostok": "Владивосток"
};

export type ClockFormat = "12" | "24";

export type FormattedClock = Readonly<{
  time: string;
  date: string;
  timeZoneLabel: string;
  showTimeZone: boolean;
}>;

export function getTimeZoneLabel(timeZone: string): string {
  return TIMEZONE_LABELS[timeZone] ?? timeZone.replaceAll("_", " ");
}

export function capitalizeRu(value: string): string {
  return `${value.charAt(0).toLocaleUpperCase("ru")}${value.slice(1)}`;
}

export function formatClock(input: {
  now: number;
  timeZone: string;
  systemTimeZone: string;
  timeFormat: ClockFormat;
}): FormattedClock {
  const timePattern = input.timeFormat === "12" ? "h:mm:ss aaa" : "HH:mm:ss";
  const zoned = toZonedDate(input.now, input.timeZone);

  return {
    time: formatInZone(zoned, input.timeZone, timePattern),
    date: capitalizeRu(formatInZone(zoned, input.timeZone, "EEEE, d MMMM")),
    timeZoneLabel: getTimeZoneLabel(input.timeZone),
    showTimeZone: input.timeZone !== input.systemTimeZone
  };
}
