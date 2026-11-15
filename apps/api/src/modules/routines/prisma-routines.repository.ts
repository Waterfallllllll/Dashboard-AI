import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { isUniqueViolation } from "../../shared/prisma-error.js";
import {
  calendarDate,
  formatCalendarDate,
  requiredCalendarDate
} from "../../shared/calendar-date.js";
import { newEntityId, parseUuid } from "../../shared/public-id.js";
import type { RuleChanges } from "./routine-edit.js";
import { fromStoredRecurrence, toStoredRecurrence } from "./routine-schedule.js";
import type {
  OccurrenceWrite,
  RoutineOccurrenceRecord,
  RoutineRuleRecord
} from "./routines.types.js";
import type {
  ReplaceDateInput,
  RoutinesRepository,
  SplitSeriesInput
} from "./routines.repository.js";

const RULE_LIMIT = 200;

type RuleRow = {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  startDate: Date;
  endDate: Date | null;
  recurrenceKind: RoutineRuleRecord["recurrence"]["kind"];
  recurrenceDays: number[];
  reminderLocalTime: string | null;
  timezone: string;
  status: RoutineRuleRecord["status"];
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type OccurrenceRow = {
  id: string;
  userId: string;
  routineRuleId: string;
  localDate: Date;
  titleOverride: string | null;
  status: RoutineOccurrenceRecord["status"];
  completedAt: Date | null;
  excludedAt: Date | null;
};

export class PrismaRoutinesRepository implements RoutinesRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async insertRule(rule: RoutineRuleRecord): Promise<"inserted" | "duplicate"> {
    const data = ruleData(rule);

    if (!data) {
      return "duplicate";
    }

    try {
      await this.prisma.routineRule.create({ data: data.data });
      return "inserted";
    } catch (error) {
      if (isUniqueViolation(error)) {
        return "duplicate";
      }

      throw error;
    }
  }

  async findRule(
    userId: string,
    id: string,
    includeDeleted = false
  ): Promise<RoutineRuleRecord | null> {
    const filter = ownedRule(userId, id, includeDeleted);

    if (!filter) {
      return null;
    }

    const row = await this.prisma.routineRule.findFirst({ where: filter });
    return row ? toRule(row) : null;
  }

  async findRulesByIds(userId: string, ids: readonly string[]): Promise<RoutineRuleRecord[]> {
    const owner = parseUuid(userId);
    const ruleIds = ids.flatMap((id) => {
      const parsed = parseUuid(id);
      return parsed ? [parsed] : [];
    });

    if (!owner || ruleIds.length === 0) {
      return [];
    }

    const rows = await this.prisma.routineRule.findMany({
      where: { userId: owner, id: { in: ruleIds } },
      take: RULE_LIMIT
    });
    return rows.map(toRule).filter((rule) => rule.userId === userId);
  }

  async listRules(userId: string): Promise<RoutineRuleRecord[]> {
    const owner = parseUuid(userId);

    if (!owner) {
      return [];
    }

    const rows = await this.prisma.routineRule.findMany({
      where: { userId: owner, deletedAt: null },
      orderBy: [{ startDate: "asc" }, { id: "asc" }],
      take: RULE_LIMIT
    });
    return rows.map(toRule).filter((rule) => rule.userId === userId);
  }

  async updateRule(
    userId: string,
    id: string,
    changes: RuleChanges,
    expectedUpdatedAt: Date,
    now: Date
  ): Promise<RoutineRuleRecord | "conflict" | "missing"> {
    const filter = ownedRule(userId, id, false);

    if (!filter) {
      return "missing";
    }

    const updated = await this.prisma.routineRule.updateMany({
      where: { ...filter, updatedAt: expectedUpdatedAt },
      data: ruleChanges(changes, now)
    });

    if (updated.count !== 1) {
      const exists = await this.prisma.routineRule.findFirst({
        where: filter,
        select: { id: true }
      });
      return exists ? "conflict" : "missing";
    }

    const row = await this.prisma.routineRule.findFirst({ where: filter });
    return row && row.userId === userId ? toRule(row) : "missing";
  }

  async softDelete(
    userId: string,
    id: string,
    now: Date
  ): Promise<"deleted" | "already-deleted" | "missing"> {
    const filter = ownedRule(userId, id, true);

    if (!filter) {
      return "missing";
    }

    const updated = await this.prisma.routineRule.updateMany({
      where: { ...filter, deletedAt: null },
      data: { deletedAt: now, updatedAt: now }
    });

    if (updated.count === 1) {
      return "deleted";
    }

    const existing = await this.prisma.routineRule.findFirst({
      where: filter,
      select: { id: true }
    });
    return existing ? "already-deleted" : "missing";
  }

  async restore(userId: string, id: string, now: Date): Promise<RoutineRuleRecord | "missing"> {
    const filter = ownedRule(userId, id, true);

    if (!filter) {
      return "missing";
    }

    const updated = await this.prisma.routineRule.updateMany({
      where: filter,
      data: { deletedAt: null, updatedAt: now }
    });

    if (updated.count !== 1) {
      return "missing";
    }

    const row = await this.prisma.routineRule.findFirst({ where: filter });
    return row && row.userId === userId ? toRule(row) : "missing";
  }

  async rulesCovering(userId: string, date: string): Promise<RoutineRuleRecord[]> {
    const owner = parseUuid(userId);
    const startDate = calendarDate(date);

    if (!owner || !startDate) {
      return [];
    }

    const rows = await this.prisma.routineRule.findMany({
      where: { userId: owner, deletedAt: null, startDate: { lte: startDate } },
      orderBy: [{ startDate: "asc" }, { id: "asc" }],
      take: RULE_LIMIT
    });
    return rows.map(toRule).filter((rule) => rule.userId === userId);
  }

  async occurrencesOn(userId: string, localDate: string): Promise<RoutineOccurrenceRecord[]> {
    const owner = parseUuid(userId);
    const date = calendarDate(localDate);

    if (!owner || !date) {
      return [];
    }

    const rows = await this.prisma.routineOccurrence.findMany({
      where: { userId: owner, localDate: date },
      take: RULE_LIMIT
    });
    return rows.map(toOccurrence).filter((item) => item.userId === userId);
  }

  async findOccurrence(userId: string, id: string): Promise<RoutineOccurrenceRecord | null> {
    const filter = ownedOccurrence(userId, id);

    if (!filter) {
      return null;
    }

    const row = await this.prisma.routineOccurrence.findFirst({ where: filter });
    return row && row.userId === userId ? toOccurrence(row) : null;
  }

  async ensurePending(input: {
    userId: string;
    ruleId: string;
    localDate: string;
  }): Promise<RoutineOccurrenceRecord | null> {
    const userId = parseUuid(input.userId);
    const ruleId = parseUuid(input.ruleId);
    const localDate = calendarDate(input.localDate);

    if (!userId || !ruleId || !localDate) {
      return null;
    }

    const rule = await this.prisma.routineRule.findFirst({
      where: { id: ruleId, userId, deletedAt: null },
      select: { id: true }
    });

    if (!rule) {
      return null;
    }

    const row = await this.prisma.routineOccurrence.upsert({
      where: { routineRuleId_localDate: { routineRuleId: ruleId, localDate } },
      create: {
        id: newEntityId(),
        routineRuleId: ruleId,
        userId,
        localDate,
        status: "pending"
      },
      update: {}
    });
    return row.userId === input.userId ? toOccurrence(row) : null;
  }

  async saveOccurrence(
    userId: string,
    id: string,
    patch: OccurrenceWrite
  ): Promise<RoutineOccurrenceRecord | null> {
    const filter = ownedOccurrence(userId, id);

    if (!filter) {
      return null;
    }

    const updated = await this.prisma.routineOccurrence.updateMany({
      where: filter,
      data: {
        status: patch.status,
        titleOverride: patch.titleOverride,
        completedAt: patch.completedAt,
        excludedAt: patch.excludedAt
      }
    });

    if (updated.count !== 1) {
      return null;
    }

    const row = await this.prisma.routineOccurrence.findFirst({ where: filter });
    return row && row.userId === userId ? toOccurrence(row) : null;
  }

  async replaceDate(input: ReplaceDateInput): Promise<RoutineRuleRecord | "missing"> {
    const userId = parseUuid(input.userId);
    const ruleId = parseUuid(input.ruleId);
    const date = requiredCalendarDate(input.date);
    const created = ruleData(input.created);

    if (!userId || !ruleId || !created || created.userId !== userId) {
      return "missing";
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.routineRule.findFirst({
          where: { id: ruleId, userId, deletedAt: null }
        });

        if (!existing) {
          return "missing";
        }

        await tx.routineOccurrence.upsert({
          where: { routineRuleId_localDate: { routineRuleId: ruleId, localDate: date } },
          create: {
            routineRuleId: ruleId,
            userId,
            localDate: date,
            status: "hidden",
            excludedAt: input.now
          },
          update: { status: "hidden", excludedAt: input.now }
        });
        const row = await tx.routineRule.create({ data: created.data });
        return toRule(row);
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return "missing";
      }

      throw error;
    }
  }

  async splitSeries(
    input: SplitSeriesInput
  ): Promise<{ previous: RoutineRuleRecord; created: RoutineRuleRecord } | "missing"> {
    const userId = parseUuid(input.userId);
    const ruleId = parseUuid(input.ruleId);
    const fromDate = requiredCalendarDate(input.fromDate);
    const previousEndDate = requiredCalendarDate(input.previousEndDate);
    const created = ruleData(input.created);

    if (!userId || !ruleId || !created || created.userId !== userId) {
      return "missing";
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.routineRule.updateMany({
        where: { id: ruleId, userId, deletedAt: null, updatedAt: input.expectedUpdatedAt },
        data: { endDate: previousEndDate, updatedAt: input.now }
      });

      if (updated.count !== 1) {
        return "missing";
      }

      const previous = await tx.routineRule.findFirst({ where: { id: ruleId, userId } });
      const row = await tx.routineRule.create({ data: created.data });

      if (!previous) {
        return "missing";
      }

      await tx.routineOccurrence.updateMany({
        where: { userId, routineRuleId: ruleId, localDate: { gte: fromDate } },
        data: { routineRuleId: row.id }
      });
      return { previous: toRule(previous), created: toRule(row) };
    });
  }

  async listActiveReminders(limit: number): Promise<RoutineRuleRecord[]> {
    const rows = await this.prisma.routineRule.findMany({
      where: { status: "active", deletedAt: null, reminderLocalTime: { not: null } },
      orderBy: { reminderLocalTime: "asc" },
      take: limit
    });
    return rows.flatMap((row) => {
      const rule = toRule(row);
      return rule.deletedAt || !rule.reminderLocalTime ? [] : [rule];
    });
  }
}

function ownedRule(userId: string, id: string, includeDeleted: boolean) {
  const user = parseUuid(userId);
  const ruleId = parseUuid(id);

  if (!user || !ruleId) {
    return null;
  }

  return includeDeleted
    ? { id: ruleId, userId: user }
    : { id: ruleId, userId: user, deletedAt: null };
}

function ownedOccurrence(userId: string, id: string) {
  const user = parseUuid(userId);
  const occurrenceId = parseUuid(id);

  if (!user || !occurrenceId) {
    return null;
  }

  return { id: occurrenceId, userId: user };
}

function ruleData(
  rule: RoutineRuleRecord
): { userId: string; data: Prisma.RoutineRuleUncheckedCreateInput } | null {
  const id = parseUuid(rule.id);
  const userId = parseUuid(rule.userId);

  if (!id || !userId) {
    return null;
  }

  const stored = toStoredRecurrence(rule.recurrence);

  return {
    userId,
    data: {
      id,
      userId,
      title: rule.title,
      description: rule.description,
      startDate: requiredCalendarDate(rule.startDate),
      endDate: rule.endDate ? requiredCalendarDate(rule.endDate) : null,
      recurrenceKind: stored.kind,
      recurrenceDays: stored.days,
      reminderLocalTime: rule.reminderLocalTime,
      timezone: rule.timezone,
      status: rule.status,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
      deletedAt: rule.deletedAt
    }
  };
}

function ruleChanges(changes: RuleChanges, now: Date): Prisma.RoutineRuleUpdateManyMutationInput {
  const data: Prisma.RoutineRuleUpdateManyMutationInput = { updatedAt: now };

  if (changes.title !== undefined) {
    data.title = changes.title;
  }

  if (changes.description !== undefined) {
    data.description = changes.description;
  }

  if (changes.startDate !== undefined) {
    data.startDate = requiredCalendarDate(changes.startDate);
  }

  if (changes.endDate !== undefined) {
    data.endDate = changes.endDate ? requiredCalendarDate(changes.endDate) : null;
  }

  if (changes.recurrence !== undefined) {
    const stored = toStoredRecurrence(changes.recurrence);
    data.recurrenceKind = stored.kind;
    data.recurrenceDays = stored.days;
  }

  if (changes.reminderLocalTime !== undefined) {
    data.reminderLocalTime = changes.reminderLocalTime;
  }

  if (changes.status !== undefined) {
    data.status = changes.status;
  }

  return data;
}

function toRule(row: RuleRow): RoutineRuleRecord {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    description: row.description,
    startDate: formatCalendarDate(row.startDate),
    endDate: row.endDate ? formatCalendarDate(row.endDate) : null,
    recurrence: fromStoredRecurrence({ kind: row.recurrenceKind, days: row.recurrenceDays }),
    reminderLocalTime: row.reminderLocalTime,
    timezone: row.timezone,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt
  };
}

function toOccurrence(row: OccurrenceRow): RoutineOccurrenceRecord {
  return {
    id: row.id,
    userId: row.userId,
    ruleId: row.routineRuleId,
    localDate: formatCalendarDate(row.localDate),
    titleOverride: row.titleOverride,
    status: row.status,
    completedAt: row.completedAt,
    excludedAt: row.excludedAt
  };
}
