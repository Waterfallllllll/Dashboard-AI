import type { Db, Filter, MatchKeysAndValues } from "mongodb";

import type { TimerSessionDocument } from "../../infrastructure/mongodb/collection-catalog.js";
import { duplicateKeyFields, isDuplicateKey } from "../../shared/mongo-error.js";
import { parseObjectId } from "../../shared/object-id.js";
import type { TimerCursor, TimerRecord } from "./timers.types.js";

export type TimerInsertResult = "inserted" | "duplicate" | "active-exists";

export type TimersRepository = {
  insert(session: TimerRecord): Promise<TimerInsertResult>;
  findOpen(userId: string): Promise<TimerRecord | null>;
  findById(userId: string, id: string): Promise<TimerRecord | null>;
  update(
    userId: string,
    id: string,
    expectedVersion: number,
    next: TimerRecord
  ): Promise<TimerRecord | "conflict" | "missing">;
  countCompletedWork(userId: string, from: Date, to: Date): Promise<number>;
  listCompleted(userId: string, limit: number, before: TimerCursor | null): Promise<TimerRecord[]>;
  listDue(now: Date, limit: number): Promise<TimerRecord[]>;
};

export class MongoTimersRepository implements TimersRepository {
  constructor(private readonly db: Db) {}

  async insert(session: TimerRecord): Promise<TimerInsertResult> {
    const document = sessionDocument(session);

    if (!document) {
      return "duplicate";
    }

    try {
      await this.collection().insertOne(document);
      return "inserted";
    } catch (error) {
      if (!isDuplicateKey(error)) {
        throw error;
      }

      return duplicateKeyFields(error).includes("userId") ? "active-exists" : "duplicate";
    }
  }

  async findOpen(userId: string): Promise<TimerRecord | null> {
    const id = parseObjectId(userId);

    if (!id) {
      return null;
    }

    const document = await this.collection().findOne({ userId: id, completedAt: null });
    const session = document ? toSession(document) : null;
    return session && session.userId === userId ? session : null;
  }

  async findById(userId: string, id: string): Promise<TimerRecord | null> {
    const filter = ownedFilter(userId, id);

    if (!filter) {
      return null;
    }

    const document = await this.collection().findOne(filter);
    const session = document ? toSession(document) : null;
    return session && session.userId === userId ? session : null;
  }

  async update(
    userId: string,
    id: string,
    expectedVersion: number,
    next: TimerRecord
  ): Promise<TimerRecord | "conflict" | "missing"> {
    const filter = ownedFilter(userId, id);

    if (!filter || next.userId !== userId || next.id !== id) {
      return "missing";
    }

    const document = await this.collection().findOneAndUpdate(
      { ...filter, version: expectedVersion },
      { $set: sessionFields(next) },
      { returnDocument: "after" }
    );

    if (!document) {
      const exists = await this.collection().findOne(filter, { projection: { _id: 1 } });
      return exists ? "conflict" : "missing";
    }

    const session = toSession(document);
    return session.userId === userId ? session : "missing";
  }

  async countCompletedWork(userId: string, from: Date, to: Date): Promise<number> {
    const id = parseObjectId(userId);

    if (!id) {
      return 0;
    }

    return this.collection().countDocuments({
      userId: id,
      phase: "work",
      endsAt: { $type: "date" },
      completedAt: { $gte: from, $lt: to }
    });
  }

  async listCompleted(
    userId: string,
    limit: number,
    before: TimerCursor | null
  ): Promise<TimerRecord[]> {
    const id = parseObjectId(userId);
    const beforeId = before ? parseObjectId(before.id) : null;

    if (!id || (before && !beforeId)) {
      return [];
    }

    const filter: Filter<TimerSessionDocument> = {
      userId: id,
      phase: "work",
      endsAt: { $type: "date" },
      completedAt: { $type: "date" },
      startedAt: { $type: "date" }
    };

    if (before && beforeId) {
      filter.$or = [
        { startedAt: { $lt: before.startedAt } },
        { startedAt: before.startedAt, _id: { $lt: beforeId } }
      ];
    }

    const documents = await this.collection()
      .find(filter)
      .sort({ startedAt: -1, _id: -1 })
      .limit(limit)
      .toArray();

    return documents.map(toSession).filter((session) => session.userId === userId);
  }

  async listDue(now: Date, limit: number): Promise<TimerRecord[]> {
    const documents = await this.collection()
      .find({
        completedAt: null,
        runStatus: "running",
        endsAt: { $lte: now, $type: "date" }
      })
      .sort({ endsAt: 1 })
      .limit(limit)
      .toArray();
    return documents.map(toSession);
  }

  private collection() {
    return this.db.collection<TimerSessionDocument>("timer_sessions");
  }
}

function ownedFilter(userId: string, id: string) {
  const user = parseObjectId(userId);
  const sessionId = parseObjectId(id);

  if (!user || !sessionId) {
    return null;
  }

  return { _id: sessionId, userId: user };
}

function sessionDocument(session: TimerRecord): TimerSessionDocument | null {
  const id = parseObjectId(session.id);
  const userId = parseObjectId(session.userId);

  if (!id || !userId) {
    return null;
  }

  return {
    _id: id,
    schemaVersion: 1,
    userId,
    preset: { ...session.preset },
    runStatus: session.runStatus,
    phase: session.phase,
    startedAt: session.startedAt,
    pausedAt: session.pausedAt,
    endsAt: session.endsAt,
    completedAt: session.completedAt,
    cycleNumber: session.cycleNumber,
    version: session.version
  };
}

function sessionFields(session: TimerRecord): MatchKeysAndValues<TimerSessionDocument> {
  return {
    preset: { ...session.preset },
    runStatus: session.runStatus,
    phase: session.phase,
    startedAt: session.startedAt,
    pausedAt: session.pausedAt,
    endsAt: session.endsAt,
    completedAt: session.completedAt,
    cycleNumber: session.cycleNumber,
    version: session.version
  };
}

function toSession(document: TimerSessionDocument): TimerRecord {
  return {
    id: document._id.toHexString(),
    userId: document.userId.toHexString(),
    preset: { ...document.preset },
    runStatus: document.runStatus,
    phase: document.phase,
    startedAt: document.startedAt,
    pausedAt: document.pausedAt,
    endsAt: document.endsAt,
    completedAt: document.completedAt,
    cycleNumber: document.cycleNumber,
    version: document.version
  };
}
