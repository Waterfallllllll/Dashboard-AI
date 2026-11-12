import { ObjectId, type Db } from "mongodb";

import type { ScheduledJobDocument } from "../mongodb/collection-catalog.js";
import { isDuplicateKey } from "../../shared/mongo-error.js";
import { parseObjectId } from "../../shared/object-id.js";
import type { JobQueue } from "./memory-job-queue.js";
import {
  WORK_JOB_TYPES,
  assertIdempotencyKey,
  definedPayload,
  emptyCounts,
  safeJobCode,
  type ClaimedJob,
  type JobPayload,
  type QueueCounts,
  type ScheduleJob
} from "./job-types.js";

const WORK_TYPES = [...WORK_JOB_TYPES];

export class MongoJobQueue implements JobQueue {
  constructor(private readonly db: Db) {}

  async schedule(job: ScheduleJob): Promise<"created" | "updated" | "exists"> {
    assertIdempotencyKey(job.idempotencyKey);
    const now = new Date();
    const document = jobDocument(job, now);

    if (!document) {
      throw new Error("Некорректная задача");
    }

    try {
      await this.collection().insertOne(document);
      return "created";
    } catch (error) {
      if (!isDuplicateKey(error)) {
        throw error;
      }
    }

    const updated = await this.collection().updateOne(
      { idempotencyKey: job.idempotencyKey, status: "pending" },
      {
        $set: {
          runAt: job.runAt,
          payload: document.payload,
          userId: document.userId,
          updatedAt: now
        }
      }
    );
    return updated.matchedCount === 1 ? "updated" : "exists";
  }

  async claim(workerId: string, now: Date, leaseMs: number): Promise<ClaimedJob | null> {
    const document = await this.collection().findOneAndUpdate(
      { status: "pending", runAt: { $lte: now }, type: { $in: WORK_TYPES } },
      {
        $set: {
          status: "processing",
          lockedBy: workerId,
          lockedAt: now,
          lockExpiresAt: new Date(now.getTime() + leaseMs),
          updatedAt: now
        },
        $inc: { attempts: 1 }
      },
      { sort: { runAt: 1 }, returnDocument: "after" }
    );
    return document ? toClaimed(document) : null;
  }

  async complete(id: string, workerId: string, now: Date, deleteAt: Date): Promise<boolean> {
    const filter = processingFilter(id, workerId);

    if (!filter) {
      return false;
    }

    const result = await this.collection().updateOne(filter, {
      $set: {
        status: "completed",
        lockedBy: null,
        lockedAt: null,
        lockExpiresAt: null,
        lastError: null,
        deleteAt,
        updatedAt: now
      }
    });
    return result.matchedCount === 1;
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

    const result = await this.collection().updateOne(filter, {
      $set: {
        status: "failed",
        lockedBy: null,
        lockedAt: null,
        lockExpiresAt: null,
        lastError: safeJobCode(code),
        deleteAt,
        updatedAt: now
      }
    });
    return result.matchedCount === 1;
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

    const current = await this.collection().findOne(filter);

    if (!current) {
      return "failed";
    }

    if (current.attempts >= current.maxAttempts) {
      await this.collection().updateOne(filter, {
        $set: {
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

    await this.collection().updateOne(filter, {
      $set: {
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

    const result = await this.collection().updateOne(filter, {
      $set: {
        status: "pending",
        runAt,
        lockedBy: null,
        lockedAt: null,
        lockExpiresAt: null,
        lastError: null,
        deleteAt: null,
        updatedAt: now
      },
      $inc: { attempts: -1 }
    });
    return result.matchedCount === 1;
  }

  async releaseExpired(now: Date): Promise<number> {
    const result = await this.collection().updateMany(
      {
        status: "processing",
        type: { $in: WORK_TYPES },
        lockExpiresAt: { $lte: now }
      },
      {
        $set: {
          status: "pending",
          lockedBy: null,
          lockedAt: null,
          lockExpiresAt: null,
          updatedAt: now
        }
      }
    );
    return result.modifiedCount;
  }

  async tryLock(name: string, owner: string, now: Date, ttlMs: number): Promise<boolean> {
    const key = `lock:${name}`;
    assertIdempotencyKey(key);
    const until = new Date(now.getTime() + ttlMs);
    const updated = await this.collection().findOneAndUpdate(
      {
        idempotencyKey: key,
        $or: [{ lockExpiresAt: { $lte: now } }, { lockedBy: owner }, { lockExpiresAt: null }]
      },
      {
        $set: {
          status: "processing",
          lockedBy: owner,
          lockedAt: now,
          lockExpiresAt: until,
          updatedAt: now
        }
      },
      { returnDocument: "after" }
    );

    if (updated) {
      return true;
    }

    try {
      await this.collection().insertOne({
        _id: new ObjectId(),
        schemaVersion: 1,
        type: "scheduler-lock",
        payload: {},
        runAt: now,
        status: "processing",
        attempts: 0,
        maxAttempts: 1,
        idempotencyKey: key,
        lockedBy: owner,
        lockedAt: now,
        lockExpiresAt: until,
        lastError: null,
        userId: null,
        createdAt: now,
        updatedAt: now,
        deleteAt: null
      });
      return true;
    } catch (error) {
      if (!isDuplicateKey(error)) {
        throw error;
      }

      return false;
    }
  }

  async touchHeartbeat(workerId: string, now: Date): Promise<void> {
    const key = `heartbeat:${workerId}`;
    assertIdempotencyKey(key);
    const updated = await this.collection().updateOne(
      { idempotencyKey: key },
      { $set: { updatedAt: now, lockedAt: now, lockedBy: workerId } }
    );

    if (updated.matchedCount === 1) {
      return;
    }

    try {
      await this.collection().insertOne({
        _id: new ObjectId(),
        schemaVersion: 1,
        type: "worker-heartbeat",
        payload: {},
        runAt: now,
        status: "completed",
        attempts: 0,
        maxAttempts: 1,
        idempotencyKey: key,
        lockedBy: workerId,
        lockedAt: now,
        lockExpiresAt: now,
        lastError: null,
        userId: null,
        createdAt: now,
        updatedAt: now,
        deleteAt: null
      });
    } catch (error) {
      if (!isDuplicateKey(error)) {
        throw error;
      }
    }
  }

  async counts(): Promise<QueueCounts> {
    const counts = emptyCounts();
    const rows = await this.collection()
      .aggregate<{ _id: QueueCounts[keyof QueueCounts] | string; count: number }>([
        { $match: { type: { $in: WORK_TYPES } } },
        { $group: { _id: "$status", count: { $sum: 1 } } }
      ])
      .toArray();

    for (const row of rows) {
      if (
        row._id === "pending" ||
        row._id === "processing" ||
        row._id === "completed" ||
        row._id === "failed"
      ) {
        counts[row._id] = row.count;
      }
    }

    return counts;
  }

  async oldestPendingRunAt(): Promise<Date | null> {
    const document = await this.collection().findOne(
      { status: "pending", type: { $in: WORK_TYPES } },
      { sort: { runAt: 1 }, projection: { runAt: 1 } }
    );
    return document?.runAt ?? null;
  }

  async latestHeartbeatAt(): Promise<Date | null> {
    const document = await this.collection().findOne(
      { type: "worker-heartbeat" },
      { sort: { updatedAt: -1 }, projection: { updatedAt: 1 } }
    );
    return document?.updatedAt ?? null;
  }

  private collection() {
    return this.db.collection<ScheduledJobDocument>("scheduled_jobs");
  }
}

function jobDocument(job: ScheduleJob, now: Date): ScheduledJobDocument | null {
  if (!Number.isInteger(job.maxAttempts) || job.maxAttempts < 1 || job.maxAttempts > 10) {
    return null;
  }

  const userId = job.userId === null ? null : parseObjectId(job.userId);

  if (job.userId !== null && !userId) {
    return null;
  }

  return {
    _id: new ObjectId(),
    schemaVersion: 1,
    type: job.type,
    payload: definedPayload(job.payload),
    runAt: job.runAt,
    status: "pending",
    attempts: 0,
    maxAttempts: job.maxAttempts,
    idempotencyKey: job.idempotencyKey,
    lockedBy: null,
    lockedAt: null,
    lockExpiresAt: null,
    lastError: null,
    userId,
    createdAt: now,
    updatedAt: now,
    deleteAt: null
  };
}

function processingFilter(id: string, workerId: string) {
  const jobId = parseObjectId(id);

  if (!jobId || workerId.length === 0 || workerId.length > 64) {
    return null;
  }

  return { _id: jobId, status: "processing" as const, lockedBy: workerId };
}

function toClaimed(document: ScheduledJobDocument): ClaimedJob {
  return {
    id: document._id.toHexString(),
    type: document.type,
    payload: readPayload(document.payload),
    idempotencyKey: document.idempotencyKey,
    userId: document.userId ? document.userId.toHexString() : null,
    attempts: document.attempts,
    maxAttempts: document.maxAttempts,
    runAt: document.runAt
  };
}

function readPayload(payload: ScheduledJobDocument["payload"]): JobPayload {
  return {
    ...(payload.sessionId ? { sessionId: payload.sessionId } : {}),
    ...(payload.eventType ? { eventType: payload.eventType } : {}),
    ...(payload.channel ? { channel: payload.channel } : {}),
    ...(payload.ruleId ? { ruleId: payload.ruleId } : {}),
    ...(payload.localDate ? { localDate: payload.localDate } : {}),
    ...(payload.title ? { title: payload.title } : {}),
    ...(payload.channelId ? { channelId: payload.channelId } : {}),
    ...(payload.phase ? { phase: payload.phase } : {})
  };
}
