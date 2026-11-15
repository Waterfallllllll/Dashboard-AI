"use client";

import { useEffect } from "react";

import {
  routineDayResponseSchema,
  routineDeletionResponseSchema,
  routineOccurrenceResponseSchema,
  routineRuleChangeResponseSchema,
  routineRuleListResponseSchema,
  routineRulePatchSchema,
  routineRuleResponseSchema,
  type RoutineRule
} from "@dashboard/contracts";

import { browserApi } from "@/lib/api/browser-api-client";
import { getCsrfToken } from "@/lib/api/csrf-memory";

import type { RoutineDayOffset, RoutineOccurrence } from "./routine-day";
import {
  getRoutineLibrarySnapshot,
  replaceRoutineLibrary,
  subscribeRoutineLibrary
} from "./routine-library-store";
import type { RoutineLibrary, RoutineRecurrence, RoutineTemplate, Weekday } from "./routine-rules";

let applyingRemote = false;
let hydrated = false;
let lastLibrary = "";

export function RoutineLibrarySync() {
  useEffect(() => {
    void reconcile(getRoutineLibrarySnapshot().library);

    return subscribeRoutineLibrary(() => {
      if (applyingRemote || !getCsrfToken()) {
        return;
      }

      const snapshot = getRoutineLibrarySnapshot();

      if (snapshot.saveStatus !== "saved") {
        return;
      }

      const serialized = JSON.stringify(snapshot.library);

      if (serialized === lastLibrary) {
        return;
      }

      void reconcile(snapshot.library);
    });
  }, []);

  return null;
}

async function reconcile(library: RoutineLibrary): Promise<void> {
  if (!getCsrfToken()) {
    return;
  }

  const serverRules = await listRules();

  if (!serverRules) {
    return;
  }

  if (!hydrated) {
    if (serverRules.length === 0) {
      await uploadTemplates(library.templates);
    }

    const fresh = (await listRules()) ?? serverRules;
    adopt(libraryFromRules(fresh, library));
    hydrated = true;
    return;
  }

  const serverById = new Map(serverRules.map((rule) => [rule.id, rule]));

  for (const template of library.templates) {
    const current = serverById.get(template.id);

    if (!current) {
      await uploadTemplates([template]);
      continue;
    }

    if (JSON.stringify(toTemplate(current)) !== JSON.stringify(template)) {
      await patchTemplate(template);
    }
  }

  for (const rule of serverRules) {
    if (!library.templates.some((template) => template.id === rule.id)) {
      await browserApi({
        path: `/api/v1/routine-rules/${rule.id}`,
        method: "DELETE",
        schema: routineDeletionResponseSchema
      });
    }
  }

  await pushOverrides(library);
  const fresh = await listRules();

  if (fresh) {
    adopt(libraryFromRules(fresh, library));
  }
}

function adopt(next: RoutineLibrary): void {
  lastLibrary = JSON.stringify(next);
  applyingRemote = true;
  replaceRoutineLibrary(next);
  applyingRemote = false;
}

async function uploadTemplates(templates: readonly RoutineTemplate[]): Promise<void> {
  for (const template of templates) {
    const recurrence = toApiRecurrence(template.recurrence);

    if (!recurrence) {
      continue;
    }

    await browserApi({
      path: "/api/v1/routine-rules",
      method: "POST",
      schema: routineRuleResponseSchema,
      idempotencyKey: `rule-${template.id}`,
      body: {
        title: template.title,
        description: template.description.length > 0 ? template.description : null,
        startDate: template.startDate,
        endDate: template.endDate,
        recurrence,
        reminderLocalTime: template.reminderTime,
        status: template.status
      }
    });
  }
}

async function patchTemplate(template: RoutineTemplate): Promise<void> {
  const recurrence = toApiRecurrence(template.recurrence);

  if (!recurrence) {
    return;
  }

  const body = routineRulePatchSchema.safeParse({
    scope: "template",
    title: template.title,
    description: template.description,
    startDate: template.startDate,
    endDate: template.endDate,
    recurrence,
    reminderLocalTime: template.reminderTime,
    status: template.status
  });

  if (!body.success) {
    return;
  }

  await browserApi({
    path: `/api/v1/routine-rules/${template.id}`,
    method: "PATCH",
    schema: routineRuleChangeResponseSchema,
    body: body.data
  });
}

async function pushOverrides(library: RoutineLibrary): Promise<void> {
  for (const override of library.overrides) {
    if (override.done === null && !override.hidden && override.title === null) {
      continue;
    }

    const day = await browserApi({
      path: "/api/v1/routines",
      schema: routineDayResponseSchema,
      query: { date: override.date }
    });

    if (!day.ok) {
      continue;
    }

    const item = day.data.data.items.find((entry) => entry.ruleId === override.templateId);

    if (!item) {
      continue;
    }

    await browserApi({
      path: `/api/v1/routine-occurrences/${item.id}`,
      method: "PATCH",
      schema: routineOccurrenceResponseSchema,
      body: {
        status: override.hidden ? "hidden" : override.done ? "done" : "pending",
        ...(override.title ? { title: override.title } : {})
      }
    });
  }
}

async function listRules(): Promise<RoutineRule[] | null> {
  const rules: RoutineRule[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < 3; page += 1) {
    const result = await browserApi({
      path: "/api/v1/routine-rules",
      schema: routineRuleListResponseSchema,
      query: { limit: "100", ...(cursor ? { cursor } : {}) }
    });

    if (!result.ok) {
      return null;
    }

    rules.push(...result.data.data);
    const nextCursor = result.data.meta.page.nextCursor;
    cursor = nextCursor ?? undefined;

    if (!cursor) {
      break;
    }
  }

  return rules;
}

function libraryFromRules(rules: readonly RoutineRule[], current: RoutineLibrary): RoutineLibrary {
  const templates = rules.map(toTemplate);
  const ids = new Set(templates.map((template) => template.id));

  return {
    customized: templates.length > 0 || current.customized,
    templates,
    overrides: current.overrides.filter((override) => ids.has(override.templateId))
  };
}

function toTemplate(rule: RoutineRule): RoutineTemplate {
  return {
    id: rule.id,
    title: rule.title,
    description: rule.description ?? "",
    startDate: rule.startDate,
    endDate: rule.endDate,
    seriesEndsOn: rule.endDate,
    recurrence: toLocalRecurrence(rule.recurrence),
    reminderTime: rule.reminderLocalTime,
    status: rule.status === "ended" ? "paused" : rule.status
  };
}

function toApiRecurrence(
  recurrence: RoutineRecurrence
): { kind: "daily" } | { kind: "weekdays" } | { kind: "once" } | { kind: "weekly"; days: Weekday[] } | null {
  if (recurrence.kind === "days") {
    const days = recurrence.days.filter(isWeekday);

    return days.length > 0 ? { kind: "weekly", days } : null;
  }

  return recurrence;
}

function toLocalRecurrence(recurrence: RoutineRule["recurrence"]): RoutineRecurrence {
  if (recurrence.kind === "weekly") {
    return { kind: "days", days: recurrence.days.filter(isWeekday) };
  }

  return recurrence;
}

function isWeekday(day: number): day is Weekday {
  return day >= 0 && day <= 6;
}

export async function patchRoutineOccurrence(
  id: string,
  status: "pending" | "done" | "hidden"
): Promise<boolean> {
  if (!getCsrfToken() || !isEntityId(id)) {
    return false;
  }

  const result = await browserApi({
    path: `/api/v1/routine-occurrences/${id}`,
    method: "PATCH",
    schema: routineOccurrenceResponseSchema,
    body: { status }
  });

  return result.ok;
}

export async function createOneOffRoutine(title: string, date: string): Promise<boolean> {
  if (!getCsrfToken()) {
    return false;
  }

  const result = await browserApi({
    path: "/api/v1/routine-rules",
    method: "POST",
    schema: routineRuleResponseSchema,
    idempotencyKey: crypto.randomUUID(),
    body: {
      title,
      startDate: date,
      recurrence: { kind: "once" },
      status: "active"
    }
  });

  return result.ok;
}

export async function loadRoutineDay(
  date: string,
  dayOffset: RoutineDayOffset
): Promise<RoutineOccurrence[] | null> {
  const result = await browserApi({
    path: "/api/v1/routines",
    schema: routineDayResponseSchema,
    query: { date }
  });

  if (!result.ok) {
    return null;
  }

  return result.data.data.items.flatMap((item) => {
    if (item.status === "hidden") {
      return [];
    }

    return [
      {
        id: item.id,
        title: item.title,
        dayOffset,
        done: item.status === "done"
      }
    ];
  });
}

function isEntityId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
}
