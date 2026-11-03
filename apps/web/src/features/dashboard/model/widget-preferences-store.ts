import {
  createDefaultPreferences,
  parseStoredWidgetPreferences,
  WIDGET_PREFERENCES_STORAGE_KEY,
  WIDGET_SAVE_DELAY_MS,
  type WidgetPreference
} from "./widget-preferences";

export type WidgetSaveStatus = "idle" | "pending" | "saved" | "error";

export type WidgetPreferencesSnapshot = Readonly<{
  preferences: readonly WidgetPreference[];
  saveStatus: WidgetSaveStatus;
}>;

const DEFAULT_PREFERENCES = createDefaultPreferences();

const SERVER_SNAPSHOT: WidgetPreferencesSnapshot = {
  preferences: DEFAULT_PREFERENCES,
  saveStatus: "idle"
};

let snapshot: WidgetPreferencesSnapshot = SERVER_SNAPSHOT;
let persisted: readonly WidgetPreference[] = DEFAULT_PREFERENCES;
let loaded = false;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

export function getWidgetPreferencesSnapshot(): WidgetPreferencesSnapshot {
  loadPreferences();
  return snapshot;
}

export function getWidgetPreferencesServerSnapshot(): WidgetPreferencesSnapshot {
  return SERVER_SNAPSHOT;
}

export function subscribeWidgetPreferences(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  window.addEventListener("storage", handleStorage);

  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", handleStorage);
  };
}

export function updateWidgetPreferences(
  recipe: (current: readonly WidgetPreference[]) => readonly WidgetPreference[]
): void {
  loadPreferences();
  const next = recipe(snapshot.preferences);

  if (next === snapshot.preferences) {
    return;
  }

  snapshot = {
    preferences: next,
    saveStatus: "pending"
  };
  emit();
  scheduleSave();
}

export function resetWidgetPreferencesStoreForTests(): void {
  if (saveTimer !== undefined) {
    clearTimeout(saveTimer);
    saveTimer = undefined;
  }

  loaded = false;
  snapshot = SERVER_SNAPSHOT;
  persisted = DEFAULT_PREFERENCES;
}

function loadPreferences(): void {
  if (loaded || typeof window === "undefined") {
    return;
  }

  loaded = true;
  const parsed = readPreferences();

  if (!parsed) {
    return;
  }

  persisted = parsed;
  snapshot = {
    preferences: parsed,
    saveStatus: "idle"
  };
}

function scheduleSave(): void {
  if (typeof window === "undefined") {
    return;
  }

  if (saveTimer !== undefined) {
    clearTimeout(saveTimer);
  }

  saveTimer = setTimeout(() => {
    saveTimer = undefined;

    try {
      window.localStorage.setItem(
        WIDGET_PREFERENCES_STORAGE_KEY,
        JSON.stringify(snapshot.preferences)
      );
      persisted = snapshot.preferences;
      snapshot = {
        preferences: snapshot.preferences,
        saveStatus: "saved"
      };
    } catch {
      snapshot = {
        preferences: persisted,
        saveStatus: "error"
      };
    }

    emit();
  }, WIDGET_SAVE_DELAY_MS);
}

function readPreferences(): readonly WidgetPreference[] | null {
  try {
    return parseStoredWidgetPreferences(
      window.localStorage.getItem(WIDGET_PREFERENCES_STORAGE_KEY)
    );
  } catch {
    return null;
  }
}

function handleStorage(event: StorageEvent): void {
  if (event.key !== WIDGET_PREFERENCES_STORAGE_KEY) {
    return;
  }

  const parsed = parseStoredWidgetPreferences(event.newValue);
  persisted = parsed ?? DEFAULT_PREFERENCES;
  snapshot = {
    preferences: persisted,
    saveStatus: "idle"
  };
  emit();
}

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}
