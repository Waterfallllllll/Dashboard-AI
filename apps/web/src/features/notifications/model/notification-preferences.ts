export const NOTIFICATION_PREFERENCES_STORAGE_KEY = "evergreen-notification-preferences";
export const NOTIFICATION_LOG_STORAGE_KEY = "evergreen-notification-log";

export type NotificationEventKind = "work" | "break" | "routine" | "calendar";

export type NotificationPreferences = Readonly<{
  workComplete: boolean;
  breakComplete: boolean;
  routineReminder: boolean;
  calendarReminder: boolean;
  quietStart: string | null;
  quietEnd: string | null;
}>;

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  workComplete: true,
  breakComplete: true,
  routineReminder: true,
  calendarReminder: false,
  quietStart: null,
  quietEnd: null
};

const CLOCK_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function parseNotificationPreferences(rawValue: string | null): NotificationPreferences {
  if (!rawValue) {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }

  try {
    const parsedValue: unknown = JSON.parse(rawValue);

    if (typeof parsedValue !== "object" || parsedValue === null) {
      return DEFAULT_NOTIFICATION_PREFERENCES;
    }

    const record = parsedValue as Record<string, unknown>;

    return {
      workComplete: record.workComplete !== false,
      breakComplete: record.breakComplete !== false,
      routineReminder: record.routineReminder !== false,
      calendarReminder: record.calendarReminder === true,
      quietStart: clockOrNull(record.quietStart),
      quietEnd: clockOrNull(record.quietEnd)
    };
  } catch {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
}

export function isQuietTime(now: Date, preferences: NotificationPreferences): boolean {
  if (!preferences.quietStart || !preferences.quietEnd) {
    return false;
  }

  const current = now.getHours() * 60 + now.getMinutes();
  const start = minutesOf(preferences.quietStart);
  const end = minutesOf(preferences.quietEnd);

  if (start === end) {
    return false;
  }

  if (start < end) {
    return current >= start && current < end;
  }

  return current >= start || current < end;
}

export function eventEnabled(
  kind: NotificationEventKind,
  preferences: NotificationPreferences
): boolean {
  switch (kind) {
    case "work":
      return preferences.workComplete;
    case "break":
      return preferences.breakComplete;
    case "routine":
      return preferences.routineReminder;
    case "calendar":
      return preferences.calendarReminder;
  }
}

export function rememberNotificationKey(key: string): boolean {
  const keys = readKeys();

  if (keys.includes(key)) {
    return false;
  }

  const next = [...keys, key].slice(-50);

  try {
    window.localStorage.setItem(NOTIFICATION_LOG_STORAGE_KEY, JSON.stringify(next));
  } catch {
    return true;
  }

  return true;
}

function readKeys(): string[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const parsedValue: unknown = JSON.parse(
      window.localStorage.getItem(NOTIFICATION_LOG_STORAGE_KEY) ?? "[]"
    );

    return Array.isArray(parsedValue)
      ? parsedValue.filter((item): item is string => typeof item === "string").slice(-50)
      : [];
  } catch {
    return [];
  }
}

function clockOrNull(value: unknown): string | null {
  return typeof value === "string" && CLOCK_TIME.test(value) ? value : null;
}

function minutesOf(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours! * 60 + minutes!;
}
