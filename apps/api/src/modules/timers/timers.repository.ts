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
