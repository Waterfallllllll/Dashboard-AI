import { newEntityId } from "../../shared/public-id.js";

import {
  WORK_JOB_TYPES,
  assertIdempotencyKey,
  definedPayload,
  emptyCounts,
  safeJobCode,
  type ClaimedJob,
  type JobPayload,
  type JobStatus,
  type JobType,
  type QueueCounts,
  type ScheduleJob
} from "./job-types.js";

export type JobQueue = {
  schedule(job: ScheduleJob): Promise<"created" | "updated" | "exists">;
  claim(workerId: string, now: Date, leaseMs: number): Promise<ClaimedJob | null>;
  complete(id: string, workerId: string, now: Date, deleteAt: Date): Promise<boolean>;
  fail(id: string, workerId: string, now: Date, code: string, deleteAt: Date): Promise<boolean>;
  retry(
    id: string,
    workerId: string,
    now: Date,
    nextRunAt: Date,
    code: string,
    deleteAt: Date
  ): Promise<"pending" | "failed">;
  reschedule(id: string, workerId: string, runAt: Date, now: Date): Promise<boolean>;
  releaseExpired(now: Date): Promise<number>;
  tryLock(name: string, owner: string, now: Date, ttlMs: number): Promise<boolean>;
  touchHeartbeat(workerId: string, now: Date): Promise<void>;
  counts(): Promise<QueueCounts>;
  oldestPendingRunAt(): Promise<Date | null>;
  latestHeartbeatAt(): Promise<Date | null>;
};

type StoredJob = {
  id: string;
  type: JobType;
  payload: JobPayload;
  runAt: Date;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  idempotencyKey: string;
  lockedBy: string | null;
  lockedAt: Date | null;
  lockExpiresAt: Date | null;
  lastError: string | null;
  userId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deleteAt: Date | null;
};

export class MemoryJobQueue implements JobQueue {
  private readonly jobs: StoredJob[] = [];

  async schedule(job: ScheduleJob): Promise<"created" | "updated" | "exists"> {
    assertIdempotencyKey(job.idempotencyKey);
    const existing = this.jobs.find((item) => item.idempotencyKey === job.idempotencyKey);

    if (!existing) {
      this.jobs.push(storedFrom(job, newEntityId()));
      return "created";
    }

    if (existing.status === "pending") {
      existing.runAt = job.runAt;
      existing.payload = { ...job.payload };
      existing.updatedAt = new Date();
      existing.userId = job.userId;
      return "updated";
    }

    return "exists";
  }

  async claim(workerId: string, now: Date, leaseMs: number): Promise<ClaimedJob | null> {
    const next = this.jobs
      .filter(
        (job) =>
          job.status === "pending" && job.runAt.getTime() <= now.getTime() && isWorkType(job.type)
      )
      .sort((left, right) => left.runAt.getTime() - right.runAt.getTime())[0];

    if (!next) {
      return null;
    }

    next.status = "processing";
    next.lockedBy = workerId;
    next.lockedAt = now;
    next.lockExpiresAt = new Date(now.getTime() + leaseMs);
    next.updatedAt = now;
    next.attempts += 1;
    return toClaimed(next);
  }

  async complete(id: string, workerId: string, now: Date, deleteAt: Date): Promise<boolean> {
    const job = ownedJob(this.jobs, id, workerId);

    if (!job) {
      return false;
    }

    job.status = "completed";
    clearLock(job, now);
    job.deleteAt = deleteAt;
    job.lastError = null;
    return true;
  }

  async fail(
    id: string,
    workerId: string,
    now: Date,
    code: string,
    deleteAt: Date
  ): Promise<boolean> {
    const job = ownedJob(this.jobs, id, workerId);

    if (!job) {
      return false;
    }

    job.status = "failed";
    clearLock(job, now);
    job.deleteAt = deleteAt;
    job.lastError = safeJobCode(code);
    return true;
  }

  async retry(
    id: string,
    workerId: string,
    now: Date,
    nextRunAt: Date,
    code: string,
    deleteAt: Date
  ): Promise<"pending" | "failed"> {
    const job = ownedJob(this.jobs, id, workerId);

    if (!job) {
      return "failed";
    }

    if (job.attempts >= job.maxAttempts) {
      job.status = "failed";
      clearLock(job, now);
      job.deleteAt = deleteAt;
      job.lastError = safeJobCode(code);
      return "failed";
    }

    job.status = "pending";
    job.runAt = nextRunAt;
    clearLock(job, now);
    job.deleteAt = null;
    job.lastError = safeJobCode(code);
    return "pending";
  }

  async reschedule(id: string, workerId: string, runAt: Date, now: Date): Promise<boolean> {
    const job = ownedJob(this.jobs, id, workerId);

    if (!job) {
      return false;
    }

    job.status = "pending";
    job.runAt = runAt;
    job.attempts = Math.max(0, job.attempts - 1);
    clearLock(job, now);
    job.deleteAt = null;
    job.lastError = null;
    return true;
  }

  async releaseExpired(now: Date): Promise<number> {
    let released = 0;

    for (const job of this.jobs) {
      if (
        job.status === "processing" &&
        isWorkType(job.type) &&
        job.lockExpiresAt !== null &&
        job.lockExpiresAt.getTime() <= now.getTime()
      ) {
        job.status = "pending";
        clearLock(job, now);
        released += 1;
      }
    }

    return released;
  }

  async tryLock(name: string, owner: string, now: Date, ttlMs: number): Promise<boolean> {
    const key = `lock:${name}`;
    assertIdempotencyKey(key);
    const existing = this.jobs.find((job) => job.idempotencyKey === key);

    if (!existing) {
      this.jobs.push({
        id: newEntityId(),
        type: "scheduler-lock",
        payload: {},
        runAt: now,
        status: "processing",
        attempts: 0,
        maxAttempts: 1,
        idempotencyKey: key,
        lockedBy: owner,
        lockedAt: now,
        lockExpiresAt: new Date(now.getTime() + ttlMs),
        lastError: null,
        userId: null,
        createdAt: now,
        updatedAt: now,
        deleteAt: null
      });
      return true;
    }

    const free =
      existing.lockedBy === owner ||
      existing.lockExpiresAt === null ||
      existing.lockExpiresAt.getTime() <= now.getTime();

    if (!free) {
      return false;
    }

    existing.lockedBy = owner;
    existing.lockedAt = now;
    existing.lockExpiresAt = new Date(now.getTime() + ttlMs);
    existing.updatedAt = now;
    existing.status = "processing";
    return true;
  }

  async touchHeartbeat(workerId: string, now: Date): Promise<void> {
    const key = `heartbeat:${workerId}`;
    assertIdempotencyKey(key);
    const existing = this.jobs.find((job) => job.idempotencyKey === key);

    if (existing) {
      existing.updatedAt = now;
      existing.lockedAt = now;
      return;
    }

    this.jobs.push({
      id: newEntityId(),
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
  }

  async counts(): Promise<QueueCounts> {
    const counts = emptyCounts();

    for (const job of this.jobs) {
      if (isWorkType(job.type)) {
        counts[job.status] += 1;
      }
    }

    return counts;
  }

  async oldestPendingRunAt(): Promise<Date | null> {
    const pending = this.jobs
      .filter((job) => job.status === "pending" && isWorkType(job.type))
      .sort((left, right) => left.runAt.getTime() - right.runAt.getTime())[0];
    return pending?.runAt ?? null;
  }

  async latestHeartbeatAt(): Promise<Date | null> {
    const beats = this.jobs
      .filter((job) => job.type === "worker-heartbeat")
      .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())[0];
    return beats?.updatedAt ?? null;
  }
}

function storedFrom(job: ScheduleJob, id: string): StoredJob {
  const now = new Date();
  return {
    id,
    type: job.type,
    payload: { ...definedPayload(job.payload) },
    runAt: job.runAt,
    status: "pending",
    attempts: 0,
    maxAttempts: job.maxAttempts,
    idempotencyKey: job.idempotencyKey,
    lockedBy: null,
    lockedAt: null,
    lockExpiresAt: null,
    lastError: null,
    userId: job.userId,
    createdAt: now,
    updatedAt: now,
    deleteAt: null
  };
}

function toClaimed(job: StoredJob): ClaimedJob {
  return {
    id: job.id,
    type: job.type,
    payload: { ...job.payload },
    idempotencyKey: job.idempotencyKey,
    userId: job.userId,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    runAt: job.runAt
  };
}

function clearLock(job: StoredJob, now: Date): void {
  job.lockedBy = null;
  job.lockedAt = null;
  job.lockExpiresAt = null;
  job.updatedAt = now;
}

function isWorkType(type: JobType): boolean {
  return (WORK_JOB_TYPES as readonly string[]).includes(type);
}

function ownedJob(jobs: StoredJob[], id: string, workerId: string): StoredJob | undefined {
  return jobs.find(
    (job) => job.id === id && job.status === "processing" && job.lockedBy === workerId
  );
}
