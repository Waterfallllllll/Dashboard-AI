export const ROUTINE_TITLE_MAX = 120;
export const ROUTINE_DESCRIPTION_MAX = 500;
export const ROUTINE_LIBRARY_STORAGE_KEY = "evergreen-routine-library";
export const ROUTINE_SAVE_DELAY_MS = 400;

export type RoutineActivity = "active" | "paused";
export type RoutineFilterStatus = "active" | "paused" | "completed";
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type RoutineEditScope = "date" | "following" | "template";

export type RoutineRecurrence =
  | Readonly<{ kind: "daily" }>
  | Readonly<{ kind: "weekdays" }>
  | Readonly<{ kind: "days"; days: readonly Weekday[] }>
  | Readonly<{ kind: "once" }>;

export type RoutineTemplate = Readonly<{
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string | null;
  seriesEndsOn: string | null;
  recurrence: RoutineRecurrence;
  reminderTime: string | null;
  status: RoutineActivity;
}>;

export type RoutineOverride = Readonly<{
  templateId: string;
  date: string;
  done: boolean | null;
  hidden: boolean;
  title: string | null;
}>;

export type RoutineLibrary = Readonly<{
  customized: boolean;
  templates: readonly RoutineTemplate[];
  overrides: readonly RoutineOverride[];
}>;

export type RoutineDraft = Readonly<{
  title: string;
  description: string;
  startDate: string;
  endDate: string | null;
  recurrence: RoutineRecurrence;
  reminderTime: string | null;
  status: RoutineActivity;
}>;

export type RoutineField =
  "title" | "description" | "startDate" | "endDate" | "recurrence" | "reminderTime";

export type RoutineDraftResult =
  | Readonly<{ ok: true; draft: RoutineDraft }>
  | Readonly<{ ok: false; fieldErrors: Partial<Record<RoutineField, string>> }>;

export type DatedRoutine = Readonly<{
  id: string;
  templateId: string;
  title: string;
  date: string;
  done: boolean;
}>;

const WEEKDAY_LABELS = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"] as const;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const CLOCK_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function createEmptyLibrary(): RoutineLibrary {
  return {
    customized: false,
    templates: [],
    overrides: []
  };
}

export function addDays(isoDate: string, days: number): string {
  const match = ISO_DATE.exec(isoDate);

  if (!match) {
    return isoDate;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day + days));

  return utc.toISOString().slice(0, 10);
}

export function weekday(isoDate: string): Weekday {
  const match = ISO_DATE.exec(isoDate);

  if (!match) {
    return 0;
  }

  return new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  ).getUTCDay() as Weekday;
}

export function isIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));

  return (
    utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day
  );
}

export function parseRoutineDraft(input: {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  openEnded: boolean;
  recurrence: RoutineRecurrence;
  reminderTime: string;
  status: RoutineActivity;
}): RoutineDraftResult {
  const fieldErrors: Partial<Record<RoutineField, string>> = {};
  const title = input.title.trim();
  const description = input.description.trim();
  const reminderTime = input.reminderTime.trim();

  if (title.length < 1 || title.length > ROUTINE_TITLE_MAX) {
    fieldErrors.title = "Название нужно указать, не длиннее 120 символов.";
  }

  if (description.length > ROUTINE_DESCRIPTION_MAX) {
    fieldErrors.description = "Описание не длиннее 500 символов.";
  }

  if (!isIsoDate(input.startDate)) {
    fieldErrors.startDate = "Укажите дату начала.";
  }

  const endDate = input.openEnded ? null : input.endDate;

  if (!input.openEnded && !isIsoDate(input.endDate)) {
    fieldErrors.endDate = "Укажите дату окончания или оставьте рутину без конца.";
  }

  if (endDate && isIsoDate(input.startDate) && endDate < input.startDate) {
    fieldErrors.endDate = "Дата окончания не раньше даты начала.";
  }

  if (input.recurrence.kind === "days" && input.recurrence.days.length === 0) {
    fieldErrors.recurrence = "Выберите хотя бы один день недели.";
  }

  if (reminderTime.length > 0 && !CLOCK_TIME.test(reminderTime)) {
    fieldErrors.reminderTime = "Время напоминания указывается как часы и минуты.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  return {
    ok: true,
    draft: {
      title,
      description,
      startDate: input.startDate,
      endDate,
      recurrence: normalizeRecurrence(input.recurrence),
      reminderTime: reminderTime.length > 0 ? reminderTime : null,
      status: input.status
    }
  };
}

export function hasDuplicateTitle(
  library: RoutineLibrary,
  title: string,
  ignoreId?: string
): boolean {
  const normalized = title.trim().toLocaleLowerCase("ru");

  if (normalized.length === 0) {
    return false;
  }

  return library.templates.some(
    (template) => template.id !== ignoreId && template.title.toLocaleLowerCase("ru") === normalized
  );
}

export function occursOn(template: RoutineTemplate, date: string): boolean {
  if (!isIsoDate(date) || date < template.startDate) {
    return false;
  }

  if (template.endDate && date > template.endDate) {
    return false;
  }

  if (template.seriesEndsOn && date > template.seriesEndsOn) {
    return false;
  }

  switch (template.recurrence.kind) {
    case "once":
      return date === template.startDate;
    case "daily":
      return true;
    case "weekdays": {
      const day = weekday(date);
      return day >= 1 && day <= 5;
    }
    case "days":
      return template.recurrence.days.includes(weekday(date));
  }
}

export function templateFilterStatus(
  template: RoutineTemplate,
  today: string
): RoutineFilterStatus {
  if (!hasDateOnOrAfter(template, today)) {
    return "completed";
  }

  return template.status === "paused" ? "paused" : "active";
}

export function describeSchedule(template: RoutineTemplate): string {
  const reminder = template.reminderTime
    ? `напоминание в ${template.reminderTime}`
    : "без напоминания";
  let pattern = "Ежедневно";

  switch (template.recurrence.kind) {
    case "once":
      pattern = `Однократно · ${template.startDate}`;
      break;
    case "weekdays":
      pattern = "По рабочим дням";
      break;
    case "days":
      pattern = template.recurrence.days.map((day) => WEEKDAY_LABELS[day]).join(", ");
      break;
    case "daily":
      break;
  }

  return `${pattern} · ${reminder}`;
}

export function upcomingDates(template: RoutineTemplate, today: string, count: number): string[] {
  if (template.status === "paused") {
    return [];
  }

  const dates: string[] = [];
  const cursor = today < template.startDate ? template.startDate : today;

  for (let offset = 0; offset < 370 && dates.length < count; offset += 1) {
    const date = addDays(cursor, offset);

    if (occursOn(template, date)) {
      dates.push(date);
    }
  }

  return dates;
}

export function toWidgetOccurrences(
  library: RoutineLibrary,
  today: string
): Array<{ id: string; title: string; dayOffset: -1 | 0 | 1; done: boolean }> {
  return ([-1, 0, 1] as const).flatMap((dayOffset) =>
    listOnDate(library, addDays(today, dayOffset), today).map((item) => ({
      id: item.id,
      title: item.title,
      dayOffset,
      done: item.done
    }))
  );
}

export function listOnDate(library: RoutineLibrary, date: string, today: string): DatedRoutine[] {
  return library.templates.flatMap((template) => {
    const override = findOverride(library, template.id, date);

    if (override?.hidden) {
      return [];
    }

    const historicalDone = override?.done === true && date < today;
    const pausedAway = template.status === "paused" && date >= today;

    if (pausedAway || (!occursOn(template, date) && !historicalDone)) {
      return [];
    }

    return [
      {
        id: occurrenceId(template.id, date),
        templateId: template.id,
        title: override?.title ?? template.title,
        date,
        done: override?.done ?? false
      }
    ];
  });
}

export function createRoutine(library: RoutineLibrary, draft: RoutineDraft): RoutineLibrary {
  return {
    customized: true,
    templates: [...library.templates, templateFromDraft(createRoutineId(), draft)],
    overrides: library.overrides
  };
}

export function addOneOff(library: RoutineLibrary, title: string, date: string): RoutineLibrary {
  const parsed = parseRoutineDraft({
    title,
    description: "",
    startDate: date,
    endDate: date,
    openEnded: false,
    recurrence: { kind: "once" },
    reminderTime: "",
    status: "active"
  });

  if (!parsed.ok) {
    return library;
  }

  return createRoutine(library, parsed.draft);
}

export function updateRoutine(
  library: RoutineLibrary,
  templateId: string,
  draft: RoutineDraft,
  scope: RoutineEditScope,
  date: string
): RoutineLibrary {
  const current = library.templates.find((template) => template.id === templateId);

  if (!current) {
    return library;
  }

  if (scope === "template" || current.recurrence.kind === "once") {
    return {
      customized: true,
      templates: library.templates.map((template) =>
        template.id === templateId
          ? { ...templateFromDraft(templateId, draft), seriesEndsOn: current.seriesEndsOn }
          : template
      ),
      overrides: library.overrides
    };
  }

  if (scope === "date") {
    const once = createRoutine(library, {
      ...draft,
      startDate: date,
      endDate: date,
      recurrence: { kind: "once" }
    });
    return {
      ...once,
      overrides: upsertOverride(library.overrides, {
        templateId,
        date,
        done: findOverride(library, templateId, date)?.done ?? null,
        hidden: true,
        title: null
      })
    };
  }

  const nextId = createRoutineId();
  const ended = { ...current, seriesEndsOn: addDays(date, -1) };

  return {
    customized: true,
    templates: [
      ...library.templates.map((template) => (template.id === templateId ? ended : template)),
      { ...templateFromDraft(nextId, draft), startDate: date }
    ],
    overrides: library.overrides.map((override) =>
      override.templateId === templateId && override.date >= date
        ? { ...override, templateId: nextId }
        : override
    )
  };
}

export function setRoutineStatus(
  library: RoutineLibrary,
  templateId: string,
  status: RoutineActivity
): RoutineLibrary {
  return {
    ...library,
    customized: true,
    templates: library.templates.map((template) =>
      template.id === templateId ? { ...template, status } : template
    )
  };
}

export function hideOccurrence(
  library: RoutineLibrary,
  templateId: string,
  date: string
): RoutineLibrary {
  const current = findOverride(library, templateId, date);

  return {
    ...library,
    customized: true,
    overrides: upsertOverride(library.overrides, {
      templateId,
      date,
      done: current?.done ?? null,
      hidden: true,
      title: current?.title ?? null
    })
  };
}

export function endSeries(
  library: RoutineLibrary,
  templateId: string,
  date: string
): RoutineLibrary {
  return {
    ...library,
    customized: true,
    templates: library.templates.map((template) =>
      template.id === templateId ? { ...template, seriesEndsOn: addDays(date, -1) } : template
    )
  };
}

export function toggleOccurrenceDone(
  library: RoutineLibrary,
  occurrenceIdValue: string
): RoutineLibrary {
  const parsed = parseOccurrenceId(occurrenceIdValue);

  if (!parsed) {
    return library;
  }

  const current = listOnDate(library, parsed.date, parsed.date).find(
    (item) => item.id === occurrenceIdValue
  );
  const override = findOverride(library, parsed.templateId, parsed.date);

  return {
    ...library,
    customized: true,
    overrides: upsertOverride(library.overrides, {
      templateId: parsed.templateId,
      date: parsed.date,
      done: !(current?.done ?? false),
      hidden: override?.hidden ?? false,
      title: override?.title ?? null
    })
  };
}

export function occurrenceId(templateId: string, date: string): string {
  return `${templateId}@${date}`;
}

function parseOccurrenceId(value: string): { templateId: string; date: string } | null {
  const separator = value.lastIndexOf("@");

  if (separator <= 0) {
    return null;
  }

  const templateId = value.slice(0, separator);
  const date = value.slice(separator + 1);

  if (!isIsoDate(date)) {
    return null;
  }

  return { templateId, date };
}

function hasDateOnOrAfter(template: RoutineTemplate, today: string): boolean {
  const start = today < template.startDate ? template.startDate : today;

  for (let offset = 0; offset < 370; offset += 1) {
    if (occursOn(template, addDays(start, offset))) {
      return true;
    }
  }

  return false;
}

function normalizeRecurrence(recurrence: RoutineRecurrence): RoutineRecurrence {
  if (recurrence.kind !== "days") {
    return recurrence;
  }

  return {
    kind: "days",
    days: [...new Set(recurrence.days)].sort((left, right) => left - right)
  };
}

function templateFromDraft(id: string, draft: RoutineDraft): RoutineTemplate {
  return {
    id,
    title: draft.title,
    description: draft.description,
    startDate: draft.startDate,
    endDate: draft.endDate,
    seriesEndsOn: null,
    recurrence: draft.recurrence,
    reminderTime: draft.reminderTime,
    status: draft.status
  };
}

function findOverride(
  library: RoutineLibrary,
  templateId: string,
  date: string
): RoutineOverride | undefined {
  return library.overrides.find(
    (override) => override.templateId === templateId && override.date === date
  );
}

function upsertOverride(
  overrides: readonly RoutineOverride[],
  next: RoutineOverride
): RoutineOverride[] {
  const index = overrides.findIndex(
    (override) => override.templateId === next.templateId && override.date === next.date
  );

  if (index === -1) {
    return [...overrides, next];
  }

  return overrides.map((override, itemIndex) => (itemIndex === index ? next : override));
}

function createRoutineId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `routine-${Date.now().toString(36)}`;
}
