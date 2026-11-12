import { API_ERROR_CODES, RESTORE_EXPIRED } from "@dashboard/contracts";
import type {
  RoutineDay,
  RoutineListQuery,
  RoutineOccurrence,
  RoutineOccurrencePatch,
  RoutineRule,
  RoutineRuleCreate,
  RoutineRulePatch
} from "@dashboard/contracts";
import { ObjectId } from "mongodb";

import { ApiError } from "../../shared/errors/api-error.js";
import { idempotencyObjectId } from "../../shared/idempotency-id.js";
import type { Actor } from "../auth/auth.types.js";
import { isEditProblem, planRuleEdit, type RuleDraft } from "./routine-edit.js";
import { listFilterStatus, occursOn } from "./routine-schedule.js";
import type { RoutinesRepository } from "./routines.repository.js";
import type {
  OccurrenceWrite,
  RoutineOccurrenceRecord,
  RoutineRuleRecord
} from "./routines.types.js";

const UNDO_WINDOW_MS = 5_000;

export class RoutinesService {
  constructor(
    private readonly routines: RoutinesRepository,
    private readonly now: () => Date = () => new Date()
  ) {}

  async list(
    actor: Actor,
    query: RoutineListQuery,
    today: string
  ): Promise<{ rules: RoutineRule[]; nextCursor: string | null }> {
    const limit = query.limit ?? 20;
    const needle = query.q?.toLocaleLowerCase("ru");
    const filtered = (await this.routines.listRules(actor.userId))
      .filter((rule) => rule.userId === actor.userId)
      .filter(
        (rule) => query.status === undefined || listFilterStatus(rule, today) === query.status
      )
      .filter(
        (rule) => needle === undefined || rule.title.toLocaleLowerCase("ru").includes(needle)
      );
    let start = 0;

    if (query.cursor !== undefined) {
      const index = filtered.findIndex((rule) => rule.id === query.cursor);

      if (index < 0) {
        throw new ApiError({
          code: API_ERROR_CODES.validationFailed,
          fieldErrors: { cursor: ["Некорректный курсор страницы."] }
        });
      }

      start = index + 1;
    }

    const page = filtered.slice(start, start + limit);
    const last = page.at(-1);
    return {
      rules: page.map(toRuleDto),
      nextCursor: start + limit < filtered.length && last ? last.id : null
    };
  }

  async listDay(actor: Actor, date: string, today: string): Promise<RoutineDay> {
    const rules = (await this.routines.rulesCovering(actor.userId, date)).filter(
      (rule) => rule.userId === actor.userId
    );
    const stored = (await this.routines.occurrencesOn(actor.userId, date)).filter(
      (item) => item.userId === actor.userId
    );
    const byRule = new Map(stored.map((item) => [item.ruleId, item]));
    const items: RoutineOccurrence[] = [];
    const seen = new Set<string>();

    for (const rule of rules) {
      const visible = await this.visibleOccurrence(
        actor,
        rule,
        date,
        today,
        byRule.get(rule.id) ?? null
      );

      if (visible) {
        seen.add(visible.id);
        items.push(visible);
      }
    }

    const historicalIds = stored
      .filter(
        (item) =>
          !rules.some((rule) => rule.id === item.ruleId) && item.status !== "hidden" && date < today
      )
      .map((item) => item.ruleId);
    const historicalRules = await this.routines.findRulesByIds(actor.userId, historicalIds);

    for (const item of stored) {
      if (seen.has(item.id) || item.status === "hidden" || date >= today) {
        continue;
      }

      const rule = historicalRules.find(
        (candidate) => candidate.id === item.ruleId && candidate.userId === actor.userId
      );

      if (!rule) {
        continue;
      }

      items.push(toOccurrenceDto(item, rule.title));
    }

    items.sort(
      (left, right) =>
        left.title.localeCompare(right.title, "ru") || left.id.localeCompare(right.id)
    );

    return {
      date,
      items,
      progress: {
        done: items.filter((item) => item.status === "done").length,
        total: items.length
      }
    };
  }

  async create(
    actor: Actor,
    input: RoutineRuleCreate,
    timezone: string,
    idempotencyKey: string | null
  ): Promise<{ rule: RoutineRule; replayed: boolean }> {
    const now = this.now();
    const id = idempotencyKey
      ? idempotencyObjectId(actor.userId, "routine-rule", idempotencyKey)
      : new ObjectId().toHexString();
    const record = ruleRecord(id, actor.userId, draftFromCreate(input, timezone), now);
    const inserted = await this.routines.insertRule(record);

    if (inserted === "duplicate") {
      return { rule: toRuleDto(await this.ownedRule(actor, id, true)), replayed: true };
    }

    return { rule: toRuleDto(record), replayed: false };
  }

  async update(
    actor: Actor,
    id: string,
    patch: RoutineRulePatch
  ): Promise<{ rule: RoutineRule; replacedRuleId: string | null }> {
    const current = await this.ownedRule(actor, id, false);
    const plan = planRuleEdit(current, patch);

    if (isEditProblem(plan)) {
      throw new ApiError({
        code: API_ERROR_CODES.validationFailed,
        fieldErrors: { [plan.field]: [plan.message] }
      });
    }

    const now = this.now();

    if (plan.kind === "update") {
      const saved = await this.routines.updateRule(
        actor.userId,
        current.id,
        plan.changes,
        current.updatedAt,
        now
      );
      return { rule: toRuleDto(this.written(actor, saved)), replacedRuleId: null };
    }

    const created = ruleRecord(new ObjectId().toHexString(), actor.userId, plan.created, now);

    if (plan.kind === "replace-date") {
      const saved = await this.routines.replaceDate({
        userId: actor.userId,
        ruleId: current.id,
        date: plan.date,
        now,
        created
      });
      return { rule: toRuleDto(this.written(actor, saved)), replacedRuleId: current.id };
    }

    const saved = await this.routines.splitSeries({
      userId: actor.userId,
      ruleId: current.id,
      expectedUpdatedAt: current.updatedAt,
      previousEndDate: plan.previousEndDate,
      fromDate: plan.date,
      now,
      created
    });

    if (saved === "missing") {
      throw new ApiError({ code: API_ERROR_CODES.notFound });
    }

    if (saved.created.userId !== actor.userId || saved.previous.userId !== actor.userId) {
      throw new ApiError({ code: API_ERROR_CODES.notFound });
    }

    return { rule: toRuleDto(saved.created), replacedRuleId: current.id };
  }

  async remove(actor: Actor, id: string): Promise<void> {
    await this.ownedRule(actor, id, true);
    const result = await this.routines.softDelete(actor.userId, id, this.now());

    if (result === "missing") {
      throw new ApiError({ code: API_ERROR_CODES.notFound });
    }
  }

  async restore(actor: Actor, id: string): Promise<RoutineRule> {
    const current = await this.ownedRule(actor, id, true);

    if (!current.deletedAt) {
      return toRuleDto(current);
    }

    if (this.now().getTime() - current.deletedAt.getTime() > UNDO_WINDOW_MS) {
      throw new ApiError({
        code: RESTORE_EXPIRED,
        status: 409,
        message: "Отмена удаления уже недоступна."
      });
    }

    const restored = await this.routines.restore(actor.userId, id, this.now());
    return toRuleDto(this.written(actor, restored));
  }

  async updateOccurrence(
    actor: Actor,
    id: string,
    patch: RoutineOccurrencePatch
  ): Promise<RoutineOccurrence> {
    const current = await this.routines.findOccurrence(actor.userId, id);

    if (!current || current.userId !== actor.userId) {
      throw new ApiError({ code: API_ERROR_CODES.notFound });
    }

    const rule = await this.ownedRule(actor, current.ruleId, true);
    const saved = await this.routines.saveOccurrence(
      actor.userId,
      id,
      occurrenceWrite(current, patch, this.now())
    );

    if (!saved || saved.userId !== actor.userId) {
      throw new ApiError({ code: API_ERROR_CODES.notFound });
    }

    return toOccurrenceDto(saved, saved.titleOverride ?? rule.title);
  }

  private async visibleOccurrence(
    actor: Actor,
    rule: RoutineRuleRecord,
    date: string,
    today: string,
    stored: RoutineOccurrenceRecord | null
  ): Promise<RoutineOccurrence | null> {
    if (stored?.status === "hidden" || (rule.status === "paused" && date >= today)) {
      return null;
    }

    const occurs = occursOn(rule, date);

    if (!occurs && !(stored && date < today)) {
      return null;
    }

    const current =
      stored ??
      (occurs
        ? await this.routines.ensurePending({
            userId: actor.userId,
            ruleId: rule.id,
            localDate: date
          })
        : null);

    if (!current || current.userId !== actor.userId || current.status === "hidden") {
      if (occurs && !stored) {
        throw new Error("Экземпляр рутины не принадлежит пользователю");
      }

      return null;
    }

    return toOccurrenceDto(current, current.titleOverride ?? rule.title);
  }

  private async ownedRule(
    actor: Actor,
    id: string,
    includeDeleted: boolean
  ): Promise<RoutineRuleRecord> {
    const rule = await this.routines.findRule(actor.userId, id, includeDeleted);

    if (!rule || rule.userId !== actor.userId) {
      throw new ApiError({ code: API_ERROR_CODES.notFound });
    }

    return rule;
  }

  private written(
    actor: Actor,
    rule: RoutineRuleRecord | "missing" | "conflict"
  ): RoutineRuleRecord {
    if (rule === "missing") {
      throw new ApiError({ code: API_ERROR_CODES.notFound });
    }

    if (rule === "conflict" || rule.userId !== actor.userId) {
      throw new ApiError({
        code: rule === "conflict" ? API_ERROR_CODES.conflict : API_ERROR_CODES.notFound
      });
    }

    return rule;
  }
}

function draftFromCreate(input: RoutineRuleCreate, timezone: string): RuleDraft {
  return {
    title: input.title,
    description: input.description ?? null,
    startDate: input.startDate,
    endDate: input.endDate ?? null,
    recurrence:
      input.recurrence.kind === "weekly"
        ? { kind: "weekly", days: [...input.recurrence.days].sort((left, right) => left - right) }
        : input.recurrence,
    reminderLocalTime: input.reminderLocalTime ?? null,
    timezone,
    status: input.status ?? "active"
  };
}

function ruleRecord(id: string, userId: string, draft: RuleDraft, now: Date): RoutineRuleRecord {
  return {
    id,
    userId,
    title: draft.title,
    description: draft.description,
    startDate: draft.startDate,
    endDate: draft.endDate,
    recurrence: draft.recurrence,
    reminderLocalTime: draft.reminderLocalTime,
    timezone: draft.timezone,
    status: draft.status,
    createdAt: now,
    updatedAt: now,
    deletedAt: null
  };
}

function occurrenceWrite(
  current: RoutineOccurrenceRecord,
  patch: RoutineOccurrencePatch,
  now: Date
): OccurrenceWrite {
  let completedAt = current.completedAt;
  let excludedAt = current.excludedAt;

  if (patch.status === "done") {
    completedAt = current.completedAt ?? now;
    excludedAt = null;
  } else if (patch.status === "pending") {
    completedAt = null;
    excludedAt = null;
  } else if (patch.status === "hidden") {
    excludedAt = current.excludedAt ?? now;
  }

  return {
    status: patch.status ?? current.status,
    titleOverride: patch.title !== undefined ? patch.title : current.titleOverride,
    completedAt,
    excludedAt
  };
}

function toRuleDto(rule: RoutineRuleRecord): RoutineRule {
  return {
    id: rule.id,
    title: rule.title,
    description: rule.description,
    startDate: rule.startDate,
    endDate: rule.endDate,
    recurrence: rule.recurrence,
    reminderLocalTime: rule.reminderLocalTime,
    timezone: rule.timezone,
    status: rule.status,
    createdAt: rule.createdAt.toISOString(),
    updatedAt: rule.updatedAt.toISOString()
  };
}

function toOccurrenceDto(occurrence: RoutineOccurrenceRecord, title: string): RoutineOccurrence {
  return {
    id: occurrence.id,
    ruleId: occurrence.ruleId,
    localDate: occurrence.localDate,
    title,
    status: occurrence.status,
    completedAt: occurrence.completedAt ? occurrence.completedAt.toISOString() : null
  };
}
