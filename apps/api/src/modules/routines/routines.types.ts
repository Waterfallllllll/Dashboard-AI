import type { Recurrence, RoutineStatus } from "@dashboard/contracts";

export type RoutineRuleRecord = {
  readonly id: string;
  readonly userId: string;
  readonly title: string;
  readonly description: string | null;
  readonly startDate: string;
  readonly endDate: string | null;
  readonly recurrence: Recurrence;
  readonly reminderLocalTime: string | null;
  readonly timezone: string;
  readonly status: RoutineStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
};

export type RoutineOccurrenceRecord = {
  readonly id: string;
  readonly userId: string;
  readonly ruleId: string;
  readonly localDate: string;
  readonly titleOverride: string | null;
  readonly status: "pending" | "done" | "hidden";
  readonly completedAt: Date | null;
  readonly excludedAt: Date | null;
};

export type OccurrenceWrite = {
  readonly status: RoutineOccurrenceRecord["status"];
  readonly titleOverride: string | null;
  readonly completedAt: Date | null;
  readonly excludedAt: Date | null;
};

export type StoredRecurrence = {
  readonly kind: "daily" | "weekdays" | "weekly" | "once";
  readonly days: readonly number[];
};
