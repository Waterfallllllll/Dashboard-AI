import type { Recurrence, RoutineRule } from "@dashboard/contracts";

import { addDays, weekday } from "./routine-rules";

const LOOKAHEAD_DAYS = 370;
const WEEKDAY_LABELS = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"] as const;
const MONTHS = [
  "янв.",
  "февр.",
  "мар.",
  "апр.",
  "мая",
  "июн.",
  "июл.",
  "авг.",
  "сент.",
  "окт.",
  "нояб.",
  "дек."
] as const;

export type RoutineListStatus = "active" | "paused" | "completed";

export type RoutineCardModel = Readonly<{
  id: string;
  title: string;
  schedule: string;
  status: RoutineListStatus;
  statusLabel: string;
  nextDates: readonly string[];
}>;

const STATUS_LABELS: Readonly<Record<RoutineListStatus, string>> = {
  active: "Активна",
  paused: "Приостановлена",
  completed: "Завершена"
};

export function presentRoutineRule(rule: RoutineRule, today: string): RoutineCardModel {
  const status = listStatus(rule, today);

  return {
    id: rule.id,
    title: rule.title,
    schedule: describeSchedule(rule),
    status,
    statusLabel: STATUS_LABELS[status],
    nextDates: nextDates(rule, today, status)
  };
}

function listStatus(rule: RoutineRule, today: string): RoutineListStatus {
  if (!hasDateOnOrAfter(rule, today)) {
    return "completed";
  }

  return rule.status === "paused" ? "paused" : "active";
}

function hasDateOnOrAfter(rule: RoutineRule, today: string): boolean {
  const start = today < rule.startDate ? rule.startDate : today;

  for (let offset = 0; offset < LOOKAHEAD_DAYS; offset += 1) {
    if (occursOn(rule, addDays(start, offset))) {
      return true;
    }
  }

  return false;
}

function occursOn(rule: RoutineRule, date: string): boolean {
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

function describeSchedule(rule: RoutineRule): string {
  const reminder = rule.reminderLocalTime ?? "без напоминания";

  switch (rule.recurrence.kind) {
    case "once":
      return `Однократно · ${formatDay(rule.startDate)} · ${reminder}`;
    case "weekdays":
      return `По рабочим дням · ${reminder}`;
    case "weekly":
      return `${weekdayLabels(rule.recurrence)} · ${reminder}`;
    case "daily":
      return `Ежедневно · ${reminder}`;
    default: {
      const unknown: never = rule.recurrence;
      return unknown;
    }
  }
}

function weekdayLabels(recurrence: Extract<Recurrence, { kind: "weekly" }>): string {
  return [...new Set(recurrence.days)]
    .sort((left, right) => (left === 0 ? 7 : left) - (right === 0 ? 7 : right))
    .map((day) => WEEKDAY_LABELS[day] ?? "")
    .filter((label) => label.length > 0)
    .join(", ");
}

function nextDates(rule: RoutineRule, today: string, status: RoutineListStatus): readonly string[] {
  if (status === "paused") {
    return [];
  }

  if (status === "completed") {
    const date = rule.endDate ?? rule.startDate;
    return [`Выполнено ${formatDay(date)}`];
  }

  const dates: string[] = [];
  const start = today < rule.startDate ? rule.startDate : today;

  for (let offset = 0; offset < LOOKAHEAD_DAYS && dates.length < 3; offset += 1) {
    const date = addDays(start, offset);

    if (occursOn(rule, date)) {
      dates.push(date === today ? "Сегодня" : formatDay(date));
    }
  }

  return dates;
}

function formatDay(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);

  if (!match) {
    return isoDate;
  }

  const month = MONTHS[Number(match[2]) - 1];
  return `${Number(match[3])} ${month ?? match[2]}`;
}
