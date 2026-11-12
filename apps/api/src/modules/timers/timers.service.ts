import { API_ERROR_CODES, TIMER_ALREADY_RUNNING } from "@dashboard/contracts";
import type {
  TimerHistoryQuery,
  TimerPatch,
  TimerSnapshot,
  TimerStart
} from "@dashboard/contracts";
import { ObjectId } from "mongodb";

import { ApiError } from "../../shared/errors/api-error.js";
import { idempotencyObjectId } from "../../shared/idempotency-id.js";
import { zonedDayBounds } from "../../shared/local-date.js";
import type { Actor } from "../auth/auth.types.js";
import {
  applyTimerAction,
  createRunningSession,
  decodeTimerCursor,
  encodeTimerCursor,
  nextInterval,
  settleIfDue,
  toTimerSessionDto
} from "./timer-engine.js";
import type { TimersRepository } from "./timers.repository.js";
import type { TimerRecord } from "./timers.types.js";

export type DailyGoalSource = {
  dailyGoal(userId: string): Promise<number>;
};

export class TimersService {
  constructor(
    private readonly timers: TimersRepository,
    private readonly goals: DailyGoalSource,
    private readonly now: () => Date = () => new Date()
  ) {}

  async current(actor: Actor, localDate: string, timeZone: string): Promise<TimerSnapshot> {
    const loaded = await this.settleOpen(actor);
    return this.snapshot(actor, loaded.open, loaded.settled, localDate, timeZone);
  }

  async history(
    actor: Actor,
    query: TimerHistoryQuery
  ): Promise<{
    sessions: ReturnType<typeof toTimerSessionDto>[];
    nextCursor: string | null;
  }> {
    const before = "cursor" in query ? decodeTimerCursor(query.cursor) : null;

    if ("cursor" in query && !before) {
      throw new ApiError({
        code: API_ERROR_CODES.validationFailed,
        fieldErrors: { cursor: ["Некорректный курсор страницы."] }
      });
    }

    const limit = query.limit;
    const sessions = await this.timers.listCompleted(actor.userId, limit + 1, before);
    const page = sessions.filter((session) => session.userId === actor.userId).slice(0, limit);
    const last = page.at(-1);
    const hasMore = sessions.length > limit;
    return {
      sessions: page.map((session) => toTimerSessionDto(session, this.now())),
      nextCursor: hasMore && last ? encodeTimerCursor(last) : null
    };
  }

  async start(
    actor: Actor,
    input: TimerStart,
    localDate: string,
    timeZone: string,
    idempotencyKey: string | null
  ): Promise<{ snapshot: TimerSnapshot; replayed: boolean }> {
    await this.settleOpen(actor);
    const now = this.now();
    const id = idempotencyKey
      ? idempotencyObjectId(actor.userId, "timer-session", idempotencyKey)
      : new ObjectId().toHexString();
    const session = createRunningSession({
      id,
      userId: actor.userId,
      preset: input.preset,
      phase: input.phase ?? "work",
      cycleNumber: input.cycleNumber ?? 0,
      now
    });
    const inserted = await this.timers.insert(session);

    if (inserted === "active-exists") {
      throw new ApiError({
        code: TIMER_ALREADY_RUNNING,
        status: 409,
        message: "Сначала завершите или сбросьте текущий таймер."
      });
    }

    if (inserted === "duplicate") {
      const existing = await this.owned(actor, id);
      const open = existing.completedAt ? null : existing;
      return {
        snapshot: await this.snapshot(
          actor,
          open,
          existing.completedAt ? existing : null,
          localDate,
          timeZone
        ),
        replayed: true
      };
    }

    return {
      snapshot: await this.snapshot(actor, session, null, localDate, timeZone),
      replayed: false
    };
  }

  async update(
    actor: Actor,
    id: string,
    patch: TimerPatch,
    localDate: string,
    timeZone: string
  ): Promise<TimerSnapshot> {
    const current = await this.owned(actor, id);

    if (current.version !== patch.version) {
      throw new ApiError({ code: API_ERROR_CODES.conflict });
    }

    const mutation = applyTimerAction(current, patch.action, this.now());

    if (mutation.kind === "invalid") {
      throw new ApiError({
        code: API_ERROR_CODES.validationFailed,
        fieldErrors: { action: [mutation.message] }
      });
    }

    const saved = await this.timers.update(actor.userId, id, current.version, mutation.session);
    const session = this.written(actor, saved);
    return this.snapshot(
      actor,
      session.completedAt ? null : session,
      session.completedAt ? session : null,
      localDate,
      timeZone
    );
  }

  // Очередь уведомлений появится вместе с worker. До этого истёкший интервал закрывается при чтении.
  private async settleOpen(
    actor: Actor
  ): Promise<{ open: TimerRecord | null; settled: TimerRecord | null }> {
    const open = await this.timers.findOpen(actor.userId);

    if (!open || open.userId !== actor.userId) {
      return { open: null, settled: null };
    }

    const settled = settleIfDue(open, this.now());

    if (!settled.completedAt) {
      return { open, settled: null };
    }

    const saved = await this.timers.update(actor.userId, open.id, open.version, settled);

    if (saved === "conflict" || saved === "missing") {
      const again = await this.timers.findOpen(actor.userId);
      return { open: again && again.userId === actor.userId ? again : null, settled: null };
    }

    if (saved.userId !== actor.userId) {
      throw new ApiError({ code: API_ERROR_CODES.notFound });
    }

    return { open: null, settled: saved };
  }

  private async snapshot(
    actor: Actor,
    open: TimerRecord | null,
    settled: TimerRecord | null,
    localDate: string,
    timeZone: string
  ): Promise<TimerSnapshot> {
    const bounds = zonedDayBounds(localDate, timeZone);
    const source = open ?? settled;
    const [completedToday, dailyGoal] = await Promise.all([
      this.timers.countCompletedWork(actor.userId, bounds.from, bounds.to),
      this.goals.dailyGoal(actor.userId)
    ]);

    return {
      session: open ? toTimerSessionDto(open, this.now()) : null,
      settled: settled ? toTimerSessionDto(settled, this.now()) : null,
      next: source
        ? nextInterval(source.preset, source.phase, source.cycleNumber)
        : { phase: "work", cycleNumber: 0 },
      completedToday,
      dailyGoal
    };
  }

  private async owned(actor: Actor, id: string): Promise<TimerRecord> {
    const session = await this.timers.findById(actor.userId, id);

    if (!session || session.userId !== actor.userId) {
      throw new ApiError({ code: API_ERROR_CODES.notFound });
    }

    return session;
  }

  private written(actor: Actor, session: TimerRecord | "conflict" | "missing"): TimerRecord {
    if (session === "missing") {
      throw new ApiError({ code: API_ERROR_CODES.notFound });
    }

    if (session === "conflict" || session.userId !== actor.userId) {
      throw new ApiError({
        code: session === "conflict" ? API_ERROR_CODES.conflict : API_ERROR_CODES.notFound
      });
    }

    return session;
  }
}
