import {
  parseStoredPreferences,
  PROFILE_PREFERENCES_STORAGE_KEY,
  type StoredPreferences
} from "@/features/profile";

import { getSystemTimeZone } from "@/lib/format/date-time";

export const DEFAULT_CLOCK_PREFERENCES: StoredPreferences = {
  timezone: "auto",
  timeFormat: "24"
};

let cachedRaw: string | null | undefined;
let cachedValue: StoredPreferences = DEFAULT_CLOCK_PREFERENCES;

export function getClockPreferencesSnapshot(): StoredPreferences {
  let raw: string | null;

  try {
    raw = window.localStorage.getItem(PROFILE_PREFERENCES_STORAGE_KEY);
  } catch {
    raw = null;
  }

  if (raw === cachedRaw) {
    return cachedValue;
  }

  cachedRaw = raw;
  cachedValue = parseStoredPreferences(raw) ?? DEFAULT_CLOCK_PREFERENCES;
  return cachedValue;
}

export function getClockPreferencesServerSnapshot(): StoredPreferences {
  return DEFAULT_CLOCK_PREFERENCES;
}

export function subscribeClockPreferences(onStoreChange: () => void): () => void {
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
  };
}

export function resolveTimeZone(timezone: StoredPreferences["timezone"]): string {
  return timezone === "auto" ? getSystemTimeZone() : timezone;
}

export function hasStoredClockPreferences(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return (
      parseStoredPreferences(window.localStorage.getItem(PROFILE_PREFERENCES_STORAGE_KEY)) !== null
    );
  } catch {
    return false;
  }
}
