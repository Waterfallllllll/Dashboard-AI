import type { Recurrence, RoutineRulePatch, RoutineStatus } from "@dashboard/contracts";

import { addDays } from "../../shared/local-date.js";
import { occursOn } from "./routine-schedule.js";
import type { RoutineRuleRecord } from "./routines.types.js";

export type RuleChanges = {
  readonly title?: string;
  readonly description?: string | null;
  readonly startDate?: string;
  readonly endDate?: string | null;
  readonly recurrence?: Recurrence;
  readonly reminderLocalTime?: string | null;
  readonly status?: RoutineStatus;
};

export type RuleDraft = {
  readonly title: string;
  readonly description: string | null;
  readonly startDate: string;
  readonly endDate: string | null;
  readonly recurrence: Recurrence;
  readonly reminderLocalTime: string | null;
  readonly timezone: string;
  readonly status: RoutineStatus;
};

export type PlannedEdit =
  | { readonly kind: "update"; readonly changes: RuleChanges }
  | {
      readonly kind: "split";
      readonly date: string;
      readonly previousEndDate: string;
      readonly created: RuleDraft;
    }
  | { readonly kind: "replace-date"; readonly date: string; readonly created: RuleDraft };

export type EditProblem = {
  readonly field: string;
  readonly message: string;
};

export function planRuleEdit(
  rule: RoutineRuleRecord,
  patch: RoutineRulePatch
): PlannedEdit | EditProblem {
  const changes = changesFrom(patch);
  const merged = mergeRule(rule, changes);
  const rangeError = rangeProblem(merged.startDate, merged.endDate);

  if (rangeError) {
    return rangeError;
  }

  if (rule.recurrence.kind === "once" || patch.scope === "template") {
    if (patch.scope === "date" && patch.date !== rule.startDate) {
      return { field: "date", message: "Одноразовое дело относится только к дате начала." };
    }

    return { kind: "update", changes };
  }

  if (patch.date === undefined) {
    return { field: "date", message: "Укажите дату, к которой относится изменение." };
  }

  const outside =
    patch.date < rule.startDate || (rule.endDate !== null && patch.date > rule.endDate);

  if (outside) {
    return { field: "date", message: "Дата вне периода рутины." };
  }

  if (patch.scope === "date") {
    if (!occursOn(rule, patch.date)) {
      return { field: "date", message: "В этот день рутина не выполняется." };
    }

    return {
      kind: "replace-date",
      date: patch.date,
      created: {
        ...merged,
        startDate: patch.date,
        endDate: patch.date,
        recurrence: { kind: "once" },
        status:
          merged.status === "ended" ? "ended" : merged.status === "paused" ? "paused" : "active"
      }
    };
  }

  if (patch.date === rule.startDate) {
    return { kind: "update", changes };
  }

  if (merged.endDate && merged.endDate < patch.date) {
    return { field: "endDate", message: "Дата окончания не раньше выбранной даты." };
  }

  return {
    kind: "split",
    date: patch.date,
    previousEndDate: addDays(patch.date, -1),
    created: {
      ...merged,
      startDate: patch.date
    }
  };
}

export function isEditProblem(value: PlannedEdit | EditProblem): value is EditProblem {
  return !("kind" in value);
}

function changesFrom(patch: RoutineRulePatch): RuleChanges {
  const changes: {
    title?: string;
    description?: string | null;
    startDate?: string;
    endDate?: string | null;
    recurrence?: Recurrence;
    reminderLocalTime?: string | null;
    status?: RoutineStatus;
  } = {};

  if (patch.title !== undefined) {
    changes.title = patch.title;
  }

  if (patch.description !== undefined) {
    changes.description = patch.description;
  }

  if (patch.startDate !== undefined) {
    changes.startDate = patch.startDate;
  }

  if (patch.endDate !== undefined) {
    changes.endDate = patch.endDate;
  }

  if (patch.recurrence !== undefined) {
    changes.recurrence = patch.recurrence;
  }

  if (patch.reminderLocalTime !== undefined) {
    changes.reminderLocalTime = patch.reminderLocalTime;
  }

  if (patch.status !== undefined) {
    changes.status = patch.status;
  }

  return changes;
}

function mergeRule(rule: RoutineRuleRecord, changes: RuleChanges): RuleDraft {
  return {
    title: changes.title ?? rule.title,
    description: changes.description !== undefined ? changes.description : rule.description,
    startDate: changes.startDate ?? rule.startDate,
    endDate: changes.endDate !== undefined ? changes.endDate : rule.endDate,
    recurrence: changes.recurrence ?? rule.recurrence,
    reminderLocalTime:
      changes.reminderLocalTime !== undefined ? changes.reminderLocalTime : rule.reminderLocalTime,
    timezone: rule.timezone,
    status: changes.status ?? rule.status
  };
}

function rangeProblem(startDate: string, endDate: string | null): EditProblem | null {
  if (endDate && endDate < startDate) {
    return { field: "endDate", message: "Дата окончания не раньше даты начала." };
  }

  return null;
}
