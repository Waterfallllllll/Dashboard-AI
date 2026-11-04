import {
  DEFAULT_TIMER_SETTINGS,
  parseFocusJournal,
  parseTimerSettings,
  TIMER_SETTINGS_STORAGE_KEY,
  type FocusEntry,
  type TimerSettings
} from "./timer-settings";

export type TimerSettingsSnapshot = Readonly<{
  settings: TimerSettings;
  journal: readonly FocusEntry[];
}>;

const SERVER_SNAPSHOT: TimerSettingsSnapshot = {
  settings: DEFAULT_TIMER_SETTINGS,
  journal: []
};

let snapshot: TimerSettingsSnapshot = SERVER_SNAPSHOT;
let loaded = false;
const listeners = new Set<() => void>();

export function getTimerSettingsSnapshot(): TimerSettingsSnapshot {
  loadSettings();
  return snapshot;
}

export function getTimerSettingsServerSnapshot(): TimerSettingsSnapshot {
  return SERVER_SNAPSHOT;
}

export function subscribeTimerSettings(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  window.addEventListener("storage", handleStorage);

  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", handleStorage);
  };
}

export function saveTimerSettings(settings: TimerSettings): void {
  loadSettings();
  snapshot = {
    ...snapshot,
    settings
  };
  persist();
  emit();
}

export function recordFocusInterval(minutes: number, endedAt: number): void {
  loadSettings();
  const entry: FocusEntry = {
    id: `focus-${endedAt}`,
    endedAt,
    minutes
  };
  snapshot = {
    ...snapshot,
    journal: [...snapshot.journal, entry].slice(-20)
  };
  persist();
  emit();
}

export function resetTimerSettingsStoreForTests(): void {
  loaded = false;
  snapshot = SERVER_SNAPSHOT;
}

function loadSettings(): void {
  if (loaded || typeof window === "undefined") {
    return;
  }

  loaded = true;
  snapshot = readSettings();
}

function persist(): void {
  try {
    window.localStorage.setItem(TIMER_SETTINGS_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    snapshot = SERVER_SNAPSHOT;
  }
}

function readSettings(): TimerSettingsSnapshot {
  try {
    const parsedValue: unknown = JSON.parse(
      window.localStorage.getItem(TIMER_SETTINGS_STORAGE_KEY) ?? "null"
    );

    if (typeof parsedValue !== "object" || parsedValue === null) {
      return SERVER_SNAPSHOT;
    }

    const record = parsedValue as Record<string, unknown>;

    return {
      settings: parseTimerSettings(JSON.stringify(record.settings ?? record)),
      journal: parseFocusJournal(record.journal)
    };
  } catch {
    return SERVER_SNAPSHOT;
  }
}

function handleStorage(event: StorageEvent): void {
  if (event.key !== TIMER_SETTINGS_STORAGE_KEY) {
    return;
  }

  snapshot = event.newValue ? readStored(event.newValue) : SERVER_SNAPSHOT;
  loaded = true;
  emit();
}

function readStored(rawValue: string): TimerSettingsSnapshot {
  try {
    const parsedValue: unknown = JSON.parse(rawValue);

    if (typeof parsedValue !== "object" || parsedValue === null) {
      return SERVER_SNAPSHOT;
    }

    const record = parsedValue as Record<string, unknown>;

    return {
      settings: parseTimerSettings(JSON.stringify(record.settings ?? record)),
      journal: parseFocusJournal(record.journal)
    };
  } catch {
    return SERVER_SNAPSHOT;
  }
}

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}
