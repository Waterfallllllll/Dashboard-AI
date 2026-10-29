export const PROFILE_PREFERENCES_STORAGE_KEY = "evergreen-profile-preferences";

export const timezoneValues = [
  "auto",
  "Europe/Kaliningrad",
  "Europe/Moscow",
  "Europe/Samara",
  "Asia/Yekaterinburg",
  "Asia/Novosibirsk",
  "Asia/Vladivostok"
] as const;

export type TimezoneValue = (typeof timezoneValues)[number];
export type TimeFormat = "12" | "24";

export type StoredPreferences = Readonly<{
  timezone: TimezoneValue;
  timeFormat: TimeFormat;
}>;

export function isTimezoneValue(value: unknown): value is TimezoneValue {
  return typeof value === "string" && timezoneValues.some((timezone) => timezone === value);
}

export function parseStoredPreferences(rawValue: string | null): StoredPreferences | null {
  if (!rawValue) {
    return null;
  }

  try {
    const parsedValue: unknown = JSON.parse(rawValue);

    if (
      typeof parsedValue === "object" &&
      parsedValue !== null &&
      "timezone" in parsedValue &&
      "timeFormat" in parsedValue &&
      isTimezoneValue(parsedValue.timezone) &&
      (parsedValue.timeFormat === "12" || parsedValue.timeFormat === "24")
    ) {
      return {
        timezone: parsedValue.timezone,
        timeFormat: parsedValue.timeFormat
      };
    }
  } catch {
    return null;
  }

  return null;
}
