import {
  createEmptyLibrary,
  ROUTINE_LIBRARY_STORAGE_KEY,
  ROUTINE_SAVE_DELAY_MS,
  type RoutineLibrary,
  type RoutineOverride,
  type RoutineRecurrence,
  type RoutineTemplate,
  type Weekday
} from "./routine-rules";

export type RoutineSaveStatus = "idle" | "pending" | "saved" | "error";

export type RoutineLibrarySnapshot = Readonly<{
  library: RoutineLibrary;
  saveStatus: RoutineSaveStatus;
}>;

const EMPTY_LIBRARY = createEmptyLibrary();

const SERVER_SNAPSHOT: RoutineLibrarySnapshot = {
  library: EMPTY_LIBRARY,
  saveStatus: "idle"
};

let snapshot: RoutineLibrarySnapshot = SERVER_SNAPSHOT;
let persisted: RoutineLibrary = EMPTY_LIBRARY;
let loaded = false;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

export function getRoutineLibrarySnapshot(): RoutineLibrarySnapshot {
  loadLibrary();
  return snapshot;
}

export function getRoutineLibraryServerSnapshot(): RoutineLibrarySnapshot {
  return SERVER_SNAPSHOT;
}

export function subscribeRoutineLibrary(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  window.addEventListener("storage", handleStorage);

  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", handleStorage);
  };
}

export function updateRoutineLibrary(recipe: (current: RoutineLibrary) => RoutineLibrary): void {
  loadLibrary();
  const next = recipe(snapshot.library);

  if (next === snapshot.library) {
    return;
  }

  snapshot = {
    library: next,
    saveStatus: "pending"
  };
  emit();
  scheduleSave();
}

export function replaceRoutineLibrary(next: RoutineLibrary): void {
  updateRoutineLibrary(() => next);
}

export function resetRoutineLibraryStoreForTests(): void {
  if (saveTimer !== undefined) {
    clearTimeout(saveTimer);
    saveTimer = undefined;
  }

  loaded = false;
  snapshot = SERVER_SNAPSHOT;
  persisted = EMPTY_LIBRARY;
}

function loadLibrary(): void {
  if (loaded || typeof window === "undefined") {
    return;
  }

  loaded = true;
  const parsed = readLibrary();

  if (!parsed) {
    return;
  }

  persisted = parsed;
  snapshot = {
    library: parsed,
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
      window.localStorage.setItem(ROUTINE_LIBRARY_STORAGE_KEY, JSON.stringify(snapshot.library));
      persisted = snapshot.library;
      snapshot = {
        library: snapshot.library,
        saveStatus: "saved"
      };
    } catch {
      snapshot = {
        library: persisted,
        saveStatus: "error"
      };
    }

    emit();
  }, ROUTINE_SAVE_DELAY_MS);
}

function readLibrary(): RoutineLibrary | null {
  try {
    return parseStoredRoutineLibrary(window.localStorage.getItem(ROUTINE_LIBRARY_STORAGE_KEY));
  } catch {
    return null;
  }
}

function handleStorage(event: StorageEvent): void {
  if (event.key !== ROUTINE_LIBRARY_STORAGE_KEY) {
    return;
  }

  persisted = parseStoredRoutineLibrary(event.newValue) ?? EMPTY_LIBRARY;
  snapshot = {
    library: persisted,
    saveStatus: "idle"
  };
  emit();
}

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function parseStoredRoutineLibrary(rawValue: string | null): RoutineLibrary | null {
  if (!rawValue) {
    return null;
  }

  try {
    const parsedValue: unknown = JSON.parse(rawValue);

    if (!isRecord(parsedValue) || !Array.isArray(parsedValue.templates)) {
      return null;
    }

    const templates = parsedValue.templates
      .slice(0, 200)
      .map(parseTemplate)
      .filter((template): template is RoutineTemplate => template !== null);
    const overrides = Array.isArray(parsedValue.overrides)
      ? parsedValue.overrides
          .slice(0, 1000)
          .map(parseOverride)
          .filter((override): override is RoutineOverride => override !== null)
      : [];

    if (templates.length === 0 && parsedValue.customized !== true) {
      return null;
    }

    return {
      customized: parsedValue.customized === true || templates.length > 0,
      templates,
      overrides
    };
  } catch {
    return null;
  }
}

function parseTemplate(value: unknown): RoutineTemplate | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.title !== "string") {
    return null;
  }

  if (value.title.trim().length < 1 || value.title.length > 120) {
    return null;
  }

  if (typeof value.startDate !== "string" || !isDate(value.startDate)) {
    return null;
  }

  const recurrence = parseRecurrence(value.recurrence);

  if (!recurrence) {
    return null;
  }

  const endDate =
    value.endDate === null
      ? null
      : typeof value.endDate === "string" && isDate(value.endDate)
        ? value.endDate
        : undefined;
  const seriesEndsOn =
    value.seriesEndsOn === null
      ? null
      : typeof value.seriesEndsOn === "string" && isDate(value.seriesEndsOn)
        ? value.seriesEndsOn
        : undefined;

  if (endDate === undefined || seriesEndsOn === undefined) {
    return null;
  }

  return {
    id: value.id.slice(0, 80),
    title: value.title.trim(),
    description: typeof value.description === "string" ? value.description.slice(0, 500) : "",
    startDate: value.startDate,
    endDate,
    seriesEndsOn,
    recurrence,
    reminderTime:
      typeof value.reminderTime === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value.reminderTime)
        ? value.reminderTime
        : null,
    status: value.status === "paused" ? "paused" : "active"
  };
}

function parseOverride(value: unknown): RoutineOverride | null {
  if (!isRecord(value) || typeof value.templateId !== "string" || typeof value.date !== "string") {
    return null;
  }

  if (!isDate(value.date)) {
    return null;
  }

  return {
    templateId: value.templateId.slice(0, 80),
    date: value.date,
    done: typeof value.done === "boolean" ? value.done : null,
    hidden: value.hidden === true,
    title: typeof value.title === "string" ? value.title.slice(0, 120) : null
  };
}

function parseRecurrence(value: unknown): RoutineRecurrence | null {
  if (!isRecord(value)) {
    return null;
  }

  if (value.kind === "daily" || value.kind === "weekdays" || value.kind === "once") {
    return { kind: value.kind };
  }

  if (value.kind === "days" && Array.isArray(value.days)) {
    const days = value.days.filter(
      (day): day is Weekday =>
        day === 0 || day === 1 || day === 2 || day === 3 || day === 4 || day === 5 || day === 6
    );

    return days.length > 0 ? { kind: "days", days } : null;
  }

  return null;
}

function isDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
