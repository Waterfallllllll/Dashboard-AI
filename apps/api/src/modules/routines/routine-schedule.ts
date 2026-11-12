import type { Recurrence, RoutineStatus } from "@dashboard/contracts";

import { addDays, weekday } from "../../shared/local-date.js";
import type { StoredRecurrence } from "./routines.types.js";

export type ScheduleRule = {
  readonly startDate: string;
  readonly endDate: string | null;
  readonly recurrence: Recurrence;
  readonly status: RoutineStatus;
};

const LOOKAHEAD_DAYS = 370;

export function occursOn(rule: ScheduleRule, date: string): boolean {
  if (rule.status === "ended" || date < rule.startDate) {
    return false;
  }

  if (rule.endDate && date > rule.endDate) {
    return false;
  }

  switch (rule.recurrence.kind) {
    case "once":
      return date === rule.startDate;
    case "daily":
      return true;
    case "weekdays": {
      const day = weekday(date);
      return day >= 1 && day <= 5;
    }
    case "weekly":
      return rule.recurrence.days.includes(weekday(date));
    default: {
      const unknown: never = rule.recurrence;
      return unknown;
    }
  }
}

export function hasDateOnOrAfter(rule: ScheduleRule, today: string): boolean {
  const start = today < rule.startDate ? rule.startDate : today;

  for (let offset = 0; offset < LOOKAHEAD_DAYS; offset += 1) {
    if (occursOn(rule, addDays(start, offset))) {
      return true;
    }
  }

  return false;
}

export function listFilterStatus(
  rule: ScheduleRule,
  today: string
): "active" | "paused" | "completed" {
  if (!hasDateOnOrAfter(rule, today)) {
    return "completed";
  }

  return rule.status === "paused" ? "paused" : "active";
}

export function sortWeekdays(days: readonly number[]): number[] {
  return [...new Set(days)].sort((left, right) => left - right);
}

export function toStoredRecurrence(recurrence: Recurrence): {
  kind: StoredRecurrence["kind"];
  days: number[];
} {
  if (recurrence.kind === "weekly") {
    return { kind: "weekly", days: sortWeekdays(recurrence.days) };
  }

  return { kind: recurrence.kind, days: [] };
}

export function fromStoredRecurrence(value: StoredRecurrence): Recurrence {
  if (value.kind === "weekly") {
    return { kind: "weekly", days: [...value.days] };
  }

  return { kind: value.kind };
}
