import type { RuleChanges } from "./routine-edit.js";
import type {
  OccurrenceWrite,
  RoutineOccurrenceRecord,
  RoutineRuleRecord
} from "./routines.types.js";

export type ReplaceDateInput = {
  readonly userId: string;
  readonly ruleId: string;
  readonly date: string;
  readonly now: Date;
  readonly created: RoutineRuleRecord;
};

export type SplitSeriesInput = {
  readonly userId: string;
  readonly ruleId: string;
  readonly expectedUpdatedAt: Date;
  readonly previousEndDate: string;
  readonly fromDate: string;
  readonly now: Date;
  readonly created: RoutineRuleRecord;
};

export type RoutinesRepository = {
  insertRule(rule: RoutineRuleRecord): Promise<"inserted" | "duplicate">;
  findRule(userId: string, id: string, includeDeleted?: boolean): Promise<RoutineRuleRecord | null>;
  findRulesByIds(userId: string, ids: readonly string[]): Promise<RoutineRuleRecord[]>;
  listRules(userId: string): Promise<RoutineRuleRecord[]>;
  updateRule(
    userId: string,
    id: string,
    changes: RuleChanges,
    expectedUpdatedAt: Date,
    now: Date
  ): Promise<RoutineRuleRecord | "conflict" | "missing">;
  softDelete(
    userId: string,
    id: string,
    now: Date
  ): Promise<"deleted" | "already-deleted" | "missing">;
  restore(userId: string, id: string, now: Date): Promise<RoutineRuleRecord | "missing">;
  rulesCovering(userId: string, date: string): Promise<RoutineRuleRecord[]>;
  occurrencesOn(userId: string, localDate: string): Promise<RoutineOccurrenceRecord[]>;
  findOccurrence(userId: string, id: string): Promise<RoutineOccurrenceRecord | null>;
  ensurePending(input: {
    userId: string;
    ruleId: string;
    localDate: string;
  }): Promise<RoutineOccurrenceRecord | null>;
  saveOccurrence(
    userId: string,
    id: string,
    patch: OccurrenceWrite
  ): Promise<RoutineOccurrenceRecord | null>;
  replaceDate(input: ReplaceDateInput): Promise<RoutineRuleRecord | "missing">;
  splitSeries(
    input: SplitSeriesInput
  ): Promise<{ previous: RoutineRuleRecord; created: RoutineRuleRecord } | "missing">;
  listActiveReminders(limit: number): Promise<RoutineRuleRecord[]>;
};
