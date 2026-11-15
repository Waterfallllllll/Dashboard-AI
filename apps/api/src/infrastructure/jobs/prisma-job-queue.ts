import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import { fromJobType, toJobType } from "../db/enum-map.js";
import { isUniqueViolation } from "../../shared/prisma-error.js";
import { parseUuid } from "../../shared/public-id.js";
import type { JobQueue } from "./memory-job-queue.js";
import {
  WORK_JOB_TYPES,
  assertIdempotencyKey,
  definedPayload,
  emptyCounts,
  safeJobCode,
  type ClaimedJob,
  type JobPayload,
  type JobType,
  type QueueCounts,
  type ScheduleJob
} from "./job-types.js";

const WORK_TYPES = [...WORK_JOB_TYPES];

export class PrismaJobQueue implements JobQueue {
  constructor(private readonly prisma: PrismaClient) {}

  async schedule(job: ScheduleJob): Promise<"created" | "updated" | "exists"> {
    assertIdempotencyKey(job.idempotencyKey);

    if (!Number.isInteger(job.maxAttempts) || job.maxAttempts < 1 || job.maxAttempts > 10) {
      throw new Error("Некорректная задача");
    }

    const userId = job.userId === null ? null : parseUuid(job.userId);

    if (job.userId !== null && !userId) {
      throw new Error("Некорректная задача");
    }

    const now = new Date();

    try {
      await this.prisma.scheduledJob.create({
        data: {
          type: toJobType(job.type),
          payload: definedPayload(job.payload),
          runAt: job.runAt,
          status: "pending",
          maxAttempts: job.maxAttempts,
          idempotencyKey: job.idempotencyKey,
          userId,
          createdAt: now,
          updatedAt: now
        }
      });
      return "created";
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
    }

    const updated = await this.prisma.scheduledJob.updateMany({
      where: { idempotencyKey: job.idempotencyKey, status: "pending" },
      data: {
        runAt: job.runAt,
        payload: definedPayload(job.payload),
        userId,
        updatedAt: now
      }
    });
    return updated.count === 1 ? "updated" : "exists";
  }

  async claim(workerId: string, now: Date, leaseMs: number): Promise<ClaimedJob | null> {
    if (!isWorkerId(workerId)) {
      return null;
    }

    const leaseUntil = new Date(now.getTime() + leaseMs);
    const rows = await this.prisma.$queryRaw<ClaimRow[]>(Prisma.sql`
      UPDATE scheduled_jobs
      SET status = 'processing'::"job_status",
          locked_by = ${workerId},
          locked_at = ${now},
          lock_expires_at = ${leaseUntil},
          attempts = attempts + 1,
          updated_at = ${now}
      WHERE id = (
        SELECT id
        FROM scheduled_jobs
        WHERE status = 'pending'::"job_status"
          AND run_at <= ${now}
          AND type::text IN (${Prisma.join(WORK_TYPES)})
        ORDER BY run_at
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      RETURNING
        id,
        type::text AS type,
        payload,
        idempotency_key AS "idempotencyKey",
        user_id::text AS "userId",
        attempts,
        max_attempts AS "maxAttempts",
        run_at AS "runAt"
    `);
    const row = rows[0];
    return row ? toClaimed(row) : null;
  }

  async complete(id: string, workerId: string, now: Date, deleteAt: Date): Promise<boolean> {
    const filter = processingFilter(id, workerId);

    if (!filter) {
      return false;
    }

    const updated = await this.prisma.scheduledJob.updateMany({
      where: filter,
      data: {
        status: "completed",
        lockedBy: null,
        lockedAt: null,
        lockExpiresAt: null,
        lastError: null,
        deleteAt,
        updatedAt: now
      }
    });
    return updated.count === 1;
  }

  async fail(
    id: string,
    workerId: string,
    now: Date,
    code: string,
    deleteAt: Date
  ): Promise<boolean> {
    const filter = processingFilter(id, workerId);

    if (!filter) {
      return false;
    }

    const updated = await this.prisma.scheduledJob.updateMany({
      where: filter,
      data: {
        status: "failed",
        lockedBy: null,
        lockedAt: null,
        lockExpiresAt: null,
        lastError: safeJobCode(code),
        deleteAt,
        updatedAt: now
      }
    });
    return updated.count === 1;
  }

  async retry(
    id: string,
    workerId: string,
    now: Date,
    nextRunAt: Date,
    code: string,
    deleteAt: Date
  ): Promise<"pending" | "failed"> {
    const filter = processingFilter(id, workerId);

    if (!filter) {
      return "failed";
    }

    const current = await this.prisma.scheduledJob.findFirst({ where: filter });

    if (!current) {
      return "failed";
    }

    if (current.attempts >= current.maxAttempts) {
      await this.prisma.scheduledJob.updateMany({
        where: filter,
        data: {
          status: "failed",
          lockedBy: null,
          lockedAt: null,
          lockExpiresAt: null,
          lastError: safeJobCode(code),
          deleteAt,
          updatedAt: now
        }
      });
      return "failed";
    }

    await this.prisma.scheduledJob.updateMany({
      where: filter,
      data: {
        status: "pending",
        runAt: nextRunAt,
        lockedBy: null,
        lockedAt: null,
        lockExpiresAt: null,
        lastError: safeJobCode(code),
        deleteAt: null,
        updatedAt: now
      }
    });
    return "pending";
  }

  async reschedule(id: string, workerId: string, runAt: Date, now: Date): Promise<boolean> {
    const filter = processingFilter(id, workerId);

    if (!filter) {
      return false;
    }

    const updated = await this.prisma.scheduledJob.updateMany({
      where: filter,
      data: {
        status: "pending",
        runAt,
        lockedBy: null,
        lockedAt: null,
        lockExpiresAt: null,
        lastError: null,
        deleteAt: null,
        attempts: { decrement: 1 },
        updatedAt: now
      }
    });
    return updated.count === 1;
  }

  async releaseExpired(now: Date): Promise<number> {
    const updated = await this.prisma.scheduledJob.updateMany({
      where: {
        status: "processing",
        type: { in: WORK_TYPES.map((type) => toJobType(type)) },
        lockExpiresAt: { lte: now }
      },
      data: {
        status: "pending",
        lockedBy: null,
        lockedAt: null,
        lockExpiresAt: null,
        updatedAt: now
      }
    });
    return updated.count;
  }

  async tryLock(name: string, owner: string, now: Date, ttlMs: number): Promise<boolean> {
    const key = `lock:${name}`;
    assertIdempotencyKey(key);
    const until = new Date(now.getTime() + ttlMs);
    const updated = await this.prisma.scheduledJob.updateMany({
      where: {
        idempotencyKey: key,
        OR: [{ lockExpiresAt: { lte: now } }, { lockedBy: owner }, { lockExpiresAt: null }]
      },
      data: {
        status: "processing",
        lockedBy: owner,
        lockedAt: now,
        lockExpiresAt: until,
        updatedAt: now
      }
    });

    if (updated.count === 1) {
      return true;
    }

    try {
      await this.prisma.scheduledJob.create({
        data: {
          type: toJobType("scheduler-lock"),
          payload: {},
          runAt: now,
          status: "processing",
          attempts: 0,
          maxAttempts: 1,
          idempotencyKey: key,
          lockedBy: owner,
          lockedAt: now,
          lockExpiresAt: until,
          createdAt: now,
          updatedAt: now
        }
      });
      return true;
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }

      return false;
    }
  }

  async touchHeartbeat(workerId: string, now: Date): Promise<void> {
    const key = `heartbeat:${workerId}`;
    assertIdempotencyKey(key);
    const updated = await this.prisma.scheduledJob.updateMany({
      where: { idempotencyKey: key },
      data: { updatedAt: now, lockedAt: now, lockedBy: workerId }
    });

    if (updated.count === 1) {
      return;
    }

    try {
      await this.prisma.scheduledJob.create({
        data: {
          type: toJobType("worker-heartbeat"),
          payload: {},
          runAt: now,
          status: "completed",
          maxAttempts: 1,
          idempotencyKey: key,
          lockedBy: workerId,
          lockedAt: now,
          lockExpiresAt: now,
          createdAt: now,
          updatedAt: now
        }
      });
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
    }
  }

  async counts(): Promise<QueueCounts> {
    const counts = emptyCounts();
    const rows = await this.prisma.scheduledJob.groupBy({
      by: ["status"],
      where: { type: { in: WORK_TYPES.map((type) => toJobType(type)) } },
      _count: { _all: true }
    });

    for (const row of rows) {
      if (
        row.status === "pending" ||
        row.status === "processing" ||
        row.status === "completed" ||
        row.status === "failed"
      ) {
        counts[row.status] = row._count._all;
      }
    }

    return counts;
  }

  async oldestPendingRunAt(): Promise<Date | null> {
    const row = await this.prisma.scheduledJob.findFirst({
      where: {
        status: "pending",
        type: { in: WORK_TYPES.map((type) => toJobType(type)) }
      },
      orderBy: { runAt: "asc" },
      select: { runAt: true }
    });
    return row?.runAt ?? null;
  }

  async latestHeartbeatAt(): Promise<Date | null> {
    const row = await this.prisma.scheduledJob.findFirst({
      where: { type: toJobType("worker-heartbeat") },
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true }
    });
    return row?.updatedAt ?? null;
  }
}

type ClaimRow = {
  id: string;
  type: string;
  payload: unknown;
  idempotencyKey: string;
  userId: string | null;
  attempts: number;
  maxAttempts: number;
  runAt: Date;
};

function processingFilter(id: string, workerId: string) {
  const jobId = parseUuid(id);

  if (!jobId || !isWorkerId(workerId)) {
    return null;
  }

  return { id: jobId, status: "processing" as const, lockedBy: workerId };
}

function isWorkerId(workerId: string): boolean {
  return workerId.length > 0 && workerId.length <= 64;
}

function toClaimed(row: ClaimRow): ClaimedJob | null {
  const type = fromJobType(row.type);

  if (!type || !isWorkType(type)) {
    return null;
  }

  return {
    id: row.id,
    type,
    payload: readPayload(row.payload),
    idempotencyKey: row.idempotencyKey,
    userId: row.userId,
    attempts: row.attempts,
    maxAttempts: row.maxAttempts,
    runAt: row.runAt instanceof Date ? row.runAt : new Date(row.runAt)
  };
}

function isWorkType(type: JobType): type is (typeof WORK_JOB_TYPES)[number] {
  return WORK_TYPES.includes(type as (typeof WORK_JOB_TYPES)[number]);
}

function readPayload(value: unknown): JobPayload {
  if (typeof value === "string") {
    try {
      return readPayload(JSON.parse(value) as unknown);
    } catch {
      return {};
    }
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  const record = value as Record<string, unknown>;
  const payload: {
    sessionId?: string;
    eventType?: "work" | "break" | "routine" | "calendar";
    channel?: "browser" | "telegram" | "in_app";
    ruleId?: string;
    localDate?: string;
    title?: string;
    channelId?: string;
    phase?: "work" | "short-break" | "long-break";
  } = {};
  const sessionId = text(record.sessionId);
  const eventType = event(record.eventType);
  const channel = channelOf(record.channel);
  const ruleId = text(record.ruleId);
  const localDate = text(record.localDate);
  const title = text(record.title);
  const channelId = text(record.channelId);
  const phase = phaseOf(record.phase);

  if (sessionId) payload.sessionId = sessionId;
  if (eventType) payload.eventType = eventType;
  if (channel) payload.channel = channel;
  if (ruleId) payload.ruleId = ruleId;
  if (localDate) payload.localDate = localDate;
  if (title) payload.title = title;
  if (channelId) payload.channelId = channelId;
  if (phase) payload.phase = phase;
  return payload;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= 256 ? value : null;
}

function event(value: unknown): JobPayload["eventType"] | null {
  if (value === "work" || value === "break" || value === "routine" || value === "calendar") {
    return value;
  }

  return null;
}

function channelOf(value: unknown): JobPayload["channel"] | null {
  if (value === "browser" || value === "telegram" || value === "in_app") {
    return value;
  }

  return null;
}

function phaseOf(value: unknown): JobPayload["phase"] | null {
  if (value === "work" || value === "short-break" || value === "long-break") {
    return value;
  }

  return null;
}
