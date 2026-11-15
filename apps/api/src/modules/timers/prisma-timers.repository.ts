import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { fromTimerPhase, toTimerPhase } from "../../infrastructure/db/enum-map.js";
import { isUniqueViolation } from "../../shared/prisma-error.js";
import { parseUuid } from "../../shared/public-id.js";
import type { TimerCursor, TimerRecord } from "./timers.types.js";
import type { TimerInsertResult, TimersRepository } from "./timers.repository.js";

type SessionRow = {
  id: string;
  userId: string;
  mode: TimerRecord["preset"]["mode"];
  workMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  runStatus: TimerRecord["runStatus"];
  phase: "work" | "shortBreak" | "longBreak";
  startedAt: Date | null;
  pausedAt: Date | null;
  endsAt: Date | null;
  completedAt: Date | null;
  cycleNumber: number;
  version: number;
};

export class PrismaTimersRepository implements TimersRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async insert(session: TimerRecord): Promise<TimerInsertResult> {
    const data = sessionData(session);
    const sessionId = parseUuid(session.id);

    if (!data || !sessionId) {
      return "duplicate";
    }

    try {
      await this.prisma.timerSession.create({ data });
      return "inserted";
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
    }

    const same = await this.prisma.timerSession.findUnique({ where: { id: sessionId } });

    if (same) {
      return "duplicate";
    }

    const open = await this.prisma.timerSession.findFirst({
      where: { userId: data.userId, completedAt: null },
      select: { id: true }
    });
    return open ? "active-exists" : "duplicate";
  }

  async findOpen(userId: string): Promise<TimerRecord | null> {
    const id = parseUuid(userId);

    if (!id) {
      return null;
    }

    const row = await this.prisma.timerSession.findFirst({
      where: { userId: id, completedAt: null }
    });
    return row && row.userId === userId ? toSession(row) : null;
  }

  async findById(userId: string, id: string): Promise<TimerRecord | null> {
    const filter = owned(userId, id);

    if (!filter) {
      return null;
    }

    const row = await this.prisma.timerSession.findFirst({ where: filter });
    return row && row.userId === userId ? toSession(row) : null;
  }

  async update(
    userId: string,
    id: string,
    expectedVersion: number,
    next: TimerRecord
  ): Promise<TimerRecord | "conflict" | "missing"> {
    const filter = owned(userId, id);

    if (!filter || next.userId !== userId || next.id !== id) {
      return "missing";
    }

    const updated = await this.prisma.timerSession.updateMany({
      where: { ...filter, version: expectedVersion },
      data: sessionFields(next)
    });

    if (updated.count !== 1) {
      const exists = await this.prisma.timerSession.findFirst({
        where: filter,
        select: { id: true }
      });
      return exists ? "conflict" : "missing";
    }

    const row = await this.prisma.timerSession.findFirst({ where: filter });
    return row && row.userId === userId ? toSession(row) : "missing";
  }

  async countCompletedWork(userId: string, from: Date, to: Date): Promise<number> {
    const id = parseUuid(userId);

    if (!id) {
      return 0;
    }

    return this.prisma.timerSession.count({
      where: {
        userId: id,
        phase: "work",
        endsAt: { not: null },
        completedAt: { gte: from, lt: to }
      }
    });
  }

  async listCompleted(
    userId: string,
    limit: number,
    before: TimerCursor | null
  ): Promise<TimerRecord[]> {
    const id = parseUuid(userId);
    const beforeId = before ? parseUuid(before.id) : null;

    if (!id || (before && !beforeId)) {
      return [];
    }

    const rows = await this.prisma.timerSession.findMany({
      where: {
        userId: id,
        phase: "work",
        endsAt: { not: null },
        completedAt: { not: null },
        startedAt: { not: null },
        ...(before && beforeId
          ? {
              OR: [
                { startedAt: { lt: before.startedAt } },
                { startedAt: before.startedAt, id: { lt: beforeId } }
              ]
            }
          : {})
      },
      orderBy: [{ startedAt: "desc" }, { id: "desc" }],
      take: limit
    });
    return rows.map(toSession).filter((session) => session.userId === userId);
  }

  async listDue(now: Date, limit: number): Promise<TimerRecord[]> {
    const rows = await this.prisma.timerSession.findMany({
      where: {
        completedAt: null,
        runStatus: "running",
        endsAt: { lte: now }
      },
      orderBy: { endsAt: "asc" },
      take: limit
    });
    return rows.map(toSession);
  }
}

function owned(userId: string, id: string) {
  const user = parseUuid(userId);
  const sessionId = parseUuid(id);

  if (!user || !sessionId) {
    return null;
  }

  return { id: sessionId, userId: user };
}

function sessionData(session: TimerRecord): Prisma.TimerSessionUncheckedCreateInput | null {
  const id = parseUuid(session.id);
  const userId = parseUuid(session.userId);

  if (!id || !userId) {
    return null;
  }

  return {
    id,
    userId,
    ...sessionColumns(session)
  };
}

function sessionColumns(session: TimerRecord) {
  return {
    mode: session.preset.mode,
    workMinutes: session.preset.workMinutes,
    shortBreakMinutes: session.preset.shortBreakMinutes,
    longBreakMinutes: session.preset.longBreakMinutes,
    runStatus: session.runStatus,
    phase: toTimerPhase(session.phase),
    startedAt: session.startedAt,
    pausedAt: session.pausedAt,
    endsAt: session.endsAt,
    completedAt: session.completedAt,
    cycleNumber: session.cycleNumber,
    version: session.version
  };
}

function sessionFields(session: TimerRecord): Prisma.TimerSessionUpdateManyMutationInput {
  return sessionColumns(session);
}

function toSession(row: SessionRow): TimerRecord {
  return {
    id: row.id,
    userId: row.userId,
    preset: {
      mode: row.mode,
      workMinutes: row.workMinutes,
      shortBreakMinutes: row.shortBreakMinutes,
      longBreakMinutes: row.longBreakMinutes
    },
    runStatus: row.runStatus,
    phase: fromTimerPhase(row.phase),
    startedAt: row.startedAt,
    pausedAt: row.pausedAt,
    endsAt: row.endsAt,
    completedAt: row.completedAt,
    cycleNumber: row.cycleNumber,
    version: row.version
  };
}
