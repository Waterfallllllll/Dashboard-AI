import type { TimerPhase, TimerPreset, TimerRunStatus } from "@dashboard/contracts";

export type TimerRecord = {
  readonly id: string;
  readonly userId: string;
  readonly preset: TimerPreset;
  readonly runStatus: TimerRunStatus;
  readonly phase: TimerPhase;
  readonly startedAt: Date | null;
  readonly pausedAt: Date | null;
  readonly endsAt: Date | null;
  readonly completedAt: Date | null;
  readonly cycleNumber: number;
  readonly version: number;
};

export type TimerCursor = {
  readonly startedAt: Date;
  readonly id: string;
};
