import { createHash } from "node:crypto";

import { ObjectId } from "mongodb";

import type { RuleChanges } from "./routines/routine-edit.js";
import { fromStoredRecurrence, toStoredRecurrence } from "./routines/routine-schedule.js";
import type {
  ReplaceDateInput,
  RoutinesRepository,
  SplitSeriesInput
} from "./routines/routines.repository.js";
import type {
  OccurrenceWrite,
  RoutineOccurrenceRecord,
  RoutineRuleRecord
} from "./routines/routines.types.js";
import type { TimersRepository, TimerInsertResult } from "./timers/timers.repository.js";
import type { TimerCursor, TimerRecord } from "./timers/timers.types.js";
import type { WidgetsRepository } from "./widgets/widgets.repository.js";
import type { DashboardConfigRecord, WidgetRecord } from "./widgets/widgets.types.js";

export class MemoryWidgetsRepository implements WidgetsRepository {
  private readonly configs = new Map<string, DashboardConfigRecord>();

  async findByUser(userId: string): Promise<DashboardConfigRecord | null> {
    return this.configs.get(userId) ?? null;
  }

  async insert(config: DashboardConfigRecord): Promise<"inserted" | "exists"> {
    if (this.configs.has(config.userId)) {
      return "exists";
    }

    this.configs.set(config.userId, cloneConfig(config));
    return "inserted";
  }

  async replace(
    userId: string,
    widgets: readonly WidgetRecord[],
    expectedUpdatedAt: Date,
    now: Date
  ): Promise<DashboardConfigRecord | "conflict"> {
    const current = this.configs.get(userId);

    if (!current || current.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
      return "conflict";
    }

    const next = { userId, widgets: widgets.map(cloneWidget), updatedAt: now };
    this.configs.set(userId, next);
    return cloneConfig(next);
  }
}

export class MemoryRoutinesRepository implements RoutinesRepository {
  private readonly rules = new Map<string, RoutineRuleRecord>();
  private readonly occurrences = new Map<string, RoutineOccurrenceRecord>();

  async insertRule(rule: RoutineRuleRecord): Promise<"inserted" | "duplicate"> {
    if (this.rules.has(rule.id)) {
      return "duplicate";
    }

    this.rules.set(rule.id, canonicalRule(rule));
    return "inserted";
  }

  async findRule(
    userId: string,
    id: string,
    includeDeleted = false
  ): Promise<RoutineRuleRecord | null> {
    const rule = this.rules.get(id);

    if (!rule || rule.userId !== userId || (!includeDeleted && rule.deletedAt)) {
      return null;
    }

    return cloneRule(rule);
  }

  async findRulesByIds(userId: string, ids: readonly string[]): Promise<RoutineRuleRecord[]> {
    return ids.flatMap((id) => {
      const rule = this.rules.get(id);
      return rule && rule.userId === userId ? [cloneRule(rule)] : [];
    });
  }

  async listRules(userId: string): Promise<RoutineRuleRecord[]> {
    return [...this.rules.values()]
      .filter((rule) => rule.userId === userId && rule.deletedAt === null)
      .sort(byStart)
      .slice(0, 200)
      .map(cloneRule);
  }

  async updateRule(
    userId: string,
    id: string,
    changes: RuleChanges,
    expectedUpdatedAt: Date,
    now: Date
  ): Promise<RoutineRuleRecord | "conflict" | "missing"> {
    const rule = this.rules.get(id);

    if (!rule || rule.userId !== userId || rule.deletedAt) {
      return "missing";
    }

    if (rule.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
      return "conflict";
    }

    const next = applyChanges(rule, changes, now);
    this.rules.set(id, next);
    return cloneRule(next);
  }

  async softDelete(
    userId: string,
    id: string,
    now: Date
  ): Promise<"deleted" | "already-deleted" | "missing"> {
    const rule = this.rules.get(id);

    if (!rule || rule.userId !== userId) {
      return "missing";
    }

    if (rule.deletedAt) {
      return "already-deleted";
    }

    this.rules.set(id, { ...rule, deletedAt: now, updatedAt: now });
    return "deleted";
  }

  async restore(userId: string, id: string, now: Date): Promise<RoutineRuleRecord | "missing"> {
    const rule = this.rules.get(id);

    if (!rule || rule.userId !== userId) {
      return "missing";
    }

    const next = { ...rule, deletedAt: null, updatedAt: now };
    this.rules.set(id, next);
    return cloneRule(next);
  }

  async rulesCovering(userId: string, date: string): Promise<RoutineRuleRecord[]> {
    return [...this.rules.values()]
      .filter((rule) => rule.userId === userId && rule.deletedAt === null && rule.startDate <= date)
      .sort(byStart)
      .slice(0, 200)
      .map(cloneRule);
  }

  async occurrencesOn(userId: string, localDate: string): Promise<RoutineOccurrenceRecord[]> {
    return [...this.occurrences.values()]
      .filter((item) => item.userId === userId && item.localDate === localDate)
      .map(cloneOccurrence);
  }

  async findOccurrence(userId: string, id: string): Promise<RoutineOccurrenceRecord | null> {
    const item = this.occurrences.get(id);
    return item && item.userId === userId ? cloneOccurrence(item) : null;
  }

  async ensurePending(input: {
    userId: string;
    ruleId: string;
    localDate: string;
  }): Promise<RoutineOccurrenceRecord | null> {
    const existing = [...this.occurrences.values()].find(
      (item) => item.ruleId === input.ruleId && item.localDate === input.localDate
    );

    if (existing) {
      return existing.userId === input.userId ? cloneOccurrence(existing) : null;
    }

    const created: RoutineOccurrenceRecord = {
      id: occurrenceId(input.ruleId, input.localDate),
      userId: input.userId,
      ruleId: input.ruleId,
      localDate: input.localDate,
      titleOverride: null,
      status: "pending",
      completedAt: null,
      excludedAt: null
    };
    this.occurrences.set(created.id, created);
    return cloneOccurrence(created);
  }

  async saveOccurrence(
    userId: string,
    id: string,
    patch: OccurrenceWrite
  ): Promise<RoutineOccurrenceRecord | null> {
    const current = this.occurrences.get(id);

    if (!current || current.userId !== userId) {
      return null;
    }

    const next = { ...current, ...patch };
    this.occurrences.set(id, next);
    return cloneOccurrence(next);
  }

  async replaceDate(input: ReplaceDateInput): Promise<RoutineRuleRecord | "missing"> {
    const rule = this.rules.get(input.ruleId);

    if (
      !rule ||
      rule.userId !== input.userId ||
      rule.deletedAt ||
      this.rules.has(input.created.id)
    ) {
      return "missing";
    }

    const existing = [...this.occurrences.values()].find(
      (item) => item.ruleId === input.ruleId && item.localDate === input.date
    );
    const hidden: RoutineOccurrenceRecord = {
      id: existing?.id ?? occurrenceId(input.ruleId, input.date),
      userId: input.userId,
      ruleId: input.ruleId,
      localDate: input.date,
      titleOverride: existing?.titleOverride ?? null,
      status: "hidden",
      completedAt: existing?.completedAt ?? null,
      excludedAt: input.now
    };
    this.occurrences.set(hidden.id, hidden);
    const created = canonicalRule(input.created);
    this.rules.set(created.id, created);
    return cloneRule(created);
  }

  async splitSeries(
    input: SplitSeriesInput
  ): Promise<{ previous: RoutineRuleRecord; created: RoutineRuleRecord } | "missing"> {
    const rule = this.rules.get(input.ruleId);

    if (
      !rule ||
      rule.userId !== input.userId ||
      rule.deletedAt ||
      rule.updatedAt.getTime() !== input.expectedUpdatedAt.getTime() ||
      this.rules.has(input.created.id)
    ) {
      return "missing";
    }

    const previous = { ...rule, endDate: input.previousEndDate, updatedAt: input.now };
    const created = canonicalRule(input.created);
    this.rules.set(previous.id, previous);
    this.rules.set(created.id, created);

    for (const [id, item] of this.occurrences) {
      if (
        item.userId === input.userId &&
        item.ruleId === input.ruleId &&
        item.localDate >= input.fromDate
      ) {
        this.occurrences.set(id, { ...item, ruleId: created.id });
      }
    }

    return { previous: cloneRule(previous), created: cloneRule(created) };
  }
}

export class MemoryTimersRepository implements TimersRepository {
  private readonly sessions = new Map<string, TimerRecord>();

  async insert(session: TimerRecord): Promise<TimerInsertResult> {
    if (this.sessions.has(session.id)) {
      return "duplicate";
    }

    const active = [...this.sessions.values()].some(
      (item) => item.userId === session.userId && item.completedAt === null
    );

    if (active) {
      return "active-exists";
    }

    this.sessions.set(session.id, cloneTimer(session));
    return "inserted";
  }

  async findOpen(userId: string): Promise<TimerRecord | null> {
    const session = [...this.sessions.values()].find(
      (item) => item.userId === userId && item.completedAt === null
    );
    return session ? cloneTimer(session) : null;
  }

  async findById(userId: string, id: string): Promise<TimerRecord | null> {
    const session = this.sessions.get(id);
    return session && session.userId === userId ? cloneTimer(session) : null;
  }

  async update(
    userId: string,
    id: string,
    expectedVersion: number,
    next: TimerRecord
  ): Promise<TimerRecord | "conflict" | "missing"> {
    const session = this.sessions.get(id);

    if (!session || session.userId !== userId || next.userId !== userId || next.id !== id) {
      return "missing";
    }

    if (session.version !== expectedVersion) {
      return "conflict";
    }

    this.sessions.set(id, cloneTimer(next));
    return cloneTimer(next);
  }

  async countCompletedWork(userId: string, from: Date, to: Date): Promise<number> {
    return [...this.sessions.values()].filter(
      (session) =>
        session.userId === userId &&
        session.phase === "work" &&
        session.endsAt !== null &&
        session.completedAt !== null &&
        session.completedAt.getTime() >= from.getTime() &&
        session.completedAt.getTime() < to.getTime()
    ).length;
  }

  async listCompleted(
    userId: string,
    limit: number,
    before: TimerCursor | null
  ): Promise<TimerRecord[]> {
    return [...this.sessions.values()]
      .filter(
        (session) =>
          session.userId === userId &&
          session.phase === "work" &&
          session.endsAt !== null &&
          session.completedAt !== null &&
          session.startedAt !== null &&
          (before === null ||
            session.startedAt.getTime() < before.startedAt.getTime() ||
            (session.startedAt.getTime() === before.startedAt.getTime() && session.id < before.id))
      )
      .sort((left, right) => {
        const byTime = (right.startedAt?.getTime() ?? 0) - (left.startedAt?.getTime() ?? 0);
        return byTime === 0 ? right.id.localeCompare(left.id) : byTime;
      })
      .slice(0, limit)
      .map(cloneTimer);
  }
}

function cloneConfig(config: DashboardConfigRecord): DashboardConfigRecord {
  return {
    userId: config.userId,
    updatedAt: config.updatedAt,
    widgets: config.widgets.map(cloneWidget)
  };
}

function cloneWidget(widget: WidgetRecord): WidgetRecord {
  return { ...widget, settings: { ...widget.settings }, updatedAt: widget.updatedAt };
}

function cloneRule(rule: RoutineRuleRecord): RoutineRuleRecord {
  return {
    ...rule,
    recurrence:
      rule.recurrence.kind === "weekly"
        ? { kind: "weekly", days: [...rule.recurrence.days] }
        : rule.recurrence
  };
}

function canonicalRule(rule: RoutineRuleRecord): RoutineRuleRecord {
  return cloneRule({
    ...rule,
    recurrence: fromStoredRecurrence(toStoredRecurrence(rule.recurrence))
  });
}

function cloneOccurrence(item: RoutineOccurrenceRecord): RoutineOccurrenceRecord {
  return { ...item };
}

function cloneTimer(session: TimerRecord): TimerRecord {
  return { ...session, preset: { ...session.preset } };
}

function applyChanges(rule: RoutineRuleRecord, changes: RuleChanges, now: Date): RoutineRuleRecord {
  return canonicalRule({
    ...rule,
    title: changes.title ?? rule.title,
    description: changes.description !== undefined ? changes.description : rule.description,
    startDate: changes.startDate ?? rule.startDate,
    endDate: changes.endDate !== undefined ? changes.endDate : rule.endDate,
    recurrence: changes.recurrence ?? rule.recurrence,
    reminderLocalTime:
      changes.reminderLocalTime !== undefined ? changes.reminderLocalTime : rule.reminderLocalTime,
    status: changes.status ?? rule.status,
    updatedAt: now
  });
}

function byStart(left: RoutineRuleRecord, right: RoutineRuleRecord): number {
  return left.startDate.localeCompare(right.startDate) || left.id.localeCompare(right.id);
}

function occurrenceId(ruleId: string, localDate: string): string {
  const digest = createHash("sha256").update(`${ruleId}:${localDate}`).digest();
  return new ObjectId(digest.subarray(0, 12)).toHexString();
}
