import type { ClientSession, Db, MatchKeysAndValues } from "mongodb";

import type {
  RoutineOccurrenceDocument,
  RoutineRuleDocument
} from "../../infrastructure/mongodb/collection-catalog.js";
import { isDuplicateKey } from "../../shared/mongo-error.js";
import { parseObjectId } from "../../shared/object-id.js";
import type { RuleChanges } from "./routine-edit.js";
import { fromStoredRecurrence, toStoredRecurrence } from "./routine-schedule.js";
import type {
  OccurrenceWrite,
  RoutineOccurrenceRecord,
  RoutineRuleRecord
} from "./routines.types.js";

const RULE_LIMIT = 200;

export type ReplaceDateInput = {
  readonly userId: string;
  readonly ruleId: string;
  readonly date: string;
  readonly now: Date;
  readonly created: RoutineRuleRecord;
};

export type SplitSeriesInput = {
  readonly userId: string;
  readonly ruleId: string;
  readonly expectedUpdatedAt: Date;
  readonly previousEndDate: string;
  readonly fromDate: string;
  readonly now: Date;
  readonly created: RoutineRuleRecord;
};

export type RoutinesRepository = {
  insertRule(rule: RoutineRuleRecord): Promise<"inserted" | "duplicate">;
  findRule(userId: string, id: string, includeDeleted?: boolean): Promise<RoutineRuleRecord | null>;
  findRulesByIds(userId: string, ids: readonly string[]): Promise<RoutineRuleRecord[]>;
  listRules(userId: string): Promise<RoutineRuleRecord[]>;
  updateRule(
    userId: string,
    id: string,
    changes: RuleChanges,
    expectedUpdatedAt: Date,
    now: Date
  ): Promise<RoutineRuleRecord | "conflict" | "missing">;
  softDelete(
    userId: string,
    id: string,
    now: Date
  ): Promise<"deleted" | "already-deleted" | "missing">;
  restore(userId: string, id: string, now: Date): Promise<RoutineRuleRecord | "missing">;
  rulesCovering(userId: string, date: string): Promise<RoutineRuleRecord[]>;
  occurrencesOn(userId: string, localDate: string): Promise<RoutineOccurrenceRecord[]>;
  findOccurrence(userId: string, id: string): Promise<RoutineOccurrenceRecord | null>;
  ensurePending(input: {
    userId: string;
    ruleId: string;
    localDate: string;
  }): Promise<RoutineOccurrenceRecord | null>;
  saveOccurrence(
    userId: string,
    id: string,
    patch: OccurrenceWrite
  ): Promise<RoutineOccurrenceRecord | null>;
  replaceDate(input: ReplaceDateInput): Promise<RoutineRuleRecord | "missing">;
  splitSeries(
    input: SplitSeriesInput
  ): Promise<{ previous: RoutineRuleRecord; created: RoutineRuleRecord } | "missing">;
};

export class MongoRoutinesRepository implements RoutinesRepository {
  constructor(private readonly db: Db) {}

  async insertRule(rule: RoutineRuleRecord): Promise<"inserted" | "duplicate"> {
    const document = ruleDocument(rule);

    if (!document) {
      return "duplicate";
    }

    try {
      await this.rules().insertOne(document);
      return "inserted";
    } catch (error) {
      if (isDuplicateKey(error)) {
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
    const filter = ruleFilter(userId, id, includeDeleted);

    if (!filter) {
      return null;
    }

    const document = await this.rules().findOne(filter);
    return document ? toRule(document) : null;
  }

  async findRulesByIds(userId: string, ids: readonly string[]): Promise<RoutineRuleRecord[]> {
    const user = parseObjectId(userId);
    const ruleIds = ids.flatMap((id) => {
      const parsed = parseObjectId(id);
      return parsed ? [parsed] : [];
    });

    if (!user || ruleIds.length === 0) {
      return [];
    }

    const documents = await this.rules()
      .find({ userId: user, _id: { $in: ruleIds } })
      .limit(RULE_LIMIT)
      .toArray();

    return documents.map(toRule).filter((rule) => rule.userId === userId);
  }

  async listRules(userId: string): Promise<RoutineRuleRecord[]> {
    const user = parseObjectId(userId);

    if (!user) {
      return [];
    }

    const documents = await this.rules()
      .find({ userId: user, deletedAt: null })
      .sort({ startDate: 1, _id: 1 })
      .limit(RULE_LIMIT)
      .toArray();

    return documents.map(toRule).filter((rule) => rule.userId === userId);
  }

  async updateRule(
    userId: string,
    id: string,
    changes: RuleChanges,
    expectedUpdatedAt: Date,
    now: Date
  ): Promise<RoutineRuleRecord | "conflict" | "missing"> {
    const filter = ruleFilter(userId, id, false);

    if (!filter) {
      return "missing";
    }

    const document = await this.rules().findOneAndUpdate(
      { ...filter, updatedAt: expectedUpdatedAt },
      { $set: ruleChanges(changes, now) },
      { returnDocument: "after" }
    );

    if (!document) {
      const exists = await this.rules().findOne(filter, { projection: { _id: 1 } });
      return exists ? "conflict" : "missing";
    }

    const rule = toRule(document);
    return rule.userId === userId ? rule : "missing";
  }

  async softDelete(
    userId: string,
    id: string,
    now: Date
  ): Promise<"deleted" | "already-deleted" | "missing"> {
    const filter = ruleFilter(userId, id, true);

    if (!filter) {
      return "missing";
    }

    const active = await this.rules().updateOne(
      { ...filter, deletedAt: null },
      { $set: { deletedAt: now, updatedAt: now } }
    );

    if (active.matchedCount === 1) {
      return "deleted";
    }

    const existing = await this.rules().findOne(filter, { projection: { deletedAt: 1 } });
    return existing ? "already-deleted" : "missing";
  }

  async restore(userId: string, id: string, now: Date): Promise<RoutineRuleRecord | "missing"> {
    const filter = ruleFilter(userId, id, true);

    if (!filter) {
      return "missing";
    }

    const document = await this.rules().findOneAndUpdate(
      filter,
      { $set: { deletedAt: null, updatedAt: now } },
      { returnDocument: "after" }
    );
    const rule = document ? toRule(document) : null;
    return rule && rule.userId === userId ? rule : "missing";
  }

  async rulesCovering(userId: string, date: string): Promise<RoutineRuleRecord[]> {
    const user = parseObjectId(userId);

    if (!user) {
      return [];
    }

    const documents = await this.rules()
      .find({ userId: user, deletedAt: null, startDate: { $lte: date } })
      .sort({ startDate: 1, _id: 1 })
      .limit(RULE_LIMIT)
      .toArray();

    return documents.map(toRule).filter((rule) => rule.userId === userId);
  }

  async occurrencesOn(userId: string, localDate: string): Promise<RoutineOccurrenceRecord[]> {
    const user = parseObjectId(userId);

    if (!user) {
      return [];
    }

    const documents = await this.occurrences()
      .find({ userId: user, localDate })
      .limit(RULE_LIMIT)
      .toArray();

    return documents.map(toOccurrence).filter((item) => item.userId === userId);
  }

  async findOccurrence(userId: string, id: string): Promise<RoutineOccurrenceRecord | null> {
    const filter = occurrenceFilter(userId, id);

    if (!filter) {
      return null;
    }

    const document = await this.occurrences().findOne(filter);
    const occurrence = document ? toOccurrence(document) : null;
    return occurrence && occurrence.userId === userId ? occurrence : null;
  }

  async ensurePending(input: {
    userId: string;
    ruleId: string;
    localDate: string;
  }): Promise<RoutineOccurrenceRecord | null> {
    const userId = parseObjectId(input.userId);
    const ruleId = parseObjectId(input.ruleId);

    if (!userId || !ruleId) {
      return null;
    }

    const document = await this.occurrences().findOneAndUpdate(
      { userId, routineRuleId: ruleId, localDate: input.localDate },
      {
        $setOnInsert: {
          schemaVersion: 1,
          titleOverride: null,
          status: "pending",
          completedAt: null,
          excludedAt: null
        }
      },
      { upsert: true, returnDocument: "after" }
    );

    const occurrence = document ? toOccurrence(document) : null;
    return occurrence && occurrence.userId === input.userId ? occurrence : null;
  }

  async saveOccurrence(
    userId: string,
    id: string,
    patch: OccurrenceWrite
  ): Promise<RoutineOccurrenceRecord | null> {
    const filter = occurrenceFilter(userId, id);

    if (!filter) {
      return null;
    }

    const document = await this.occurrences().findOneAndUpdate(
      filter,
      {
        $set: {
          status: patch.status,
          titleOverride: patch.titleOverride,
          completedAt: patch.completedAt,
          excludedAt: patch.excludedAt
        }
      },
      { returnDocument: "after" }
    );
    const occurrence = document ? toOccurrence(document) : null;
    return occurrence && occurrence.userId === userId ? occurrence : null;
  }

  async replaceDate(input: ReplaceDateInput): Promise<RoutineRuleRecord | "missing"> {
    return this.transaction(async (session) => {
      const filter = ruleFilter(input.userId, input.ruleId, false);

      if (!filter) {
        throw new MissingDocumentError();
      }

      const existing = await this.rules().findOne(filter, { session });

      if (!existing) {
        throw new MissingDocumentError();
      }

      const userId = existing.userId;
      const ruleId = existing._id;
      await this.occurrences().updateOne(
        { userId, routineRuleId: ruleId, localDate: input.date },
        {
          $set: { status: "hidden", excludedAt: input.now },
          $setOnInsert: {
            schemaVersion: 1,
            titleOverride: null,
            completedAt: null
          }
        },
        { upsert: true, session }
      );
      const created = ruleDocument(input.created);

      if (!created || created.userId.toHexString() !== input.userId) {
        throw new MissingDocumentError();
      }

      await this.rules().insertOne(created, { session });
      return toRule(created);
    });
  }

  async splitSeries(
    input: SplitSeriesInput
  ): Promise<{ previous: RoutineRuleRecord; created: RoutineRuleRecord } | "missing"> {
    return this.transaction(async (session) => {
      const filter = ruleFilter(input.userId, input.ruleId, false);

      if (!filter) {
        throw new MissingDocumentError();
      }

      const previous = await this.rules().findOneAndUpdate(
        { ...filter, updatedAt: input.expectedUpdatedAt },
        { $set: { endDate: input.previousEndDate, updatedAt: input.now } },
        { returnDocument: "after", session }
      );

      if (!previous || previous.userId.toHexString() !== input.userId) {
        throw new MissingDocumentError();
      }

      const created = ruleDocument(input.created);

      if (!created || created.userId.toHexString() !== input.userId) {
        throw new MissingDocumentError();
      }

      await this.rules().insertOne(created, { session });
      await this.occurrences().updateMany(
        {
          userId: previous.userId,
          routineRuleId: previous._id,
          localDate: { $gte: input.fromDate }
        },
        { $set: { routineRuleId: created._id } },
        { session }
      );

      return { previous: toRule(previous), created: toRule(created) };
    });
  }

  private rules() {
    return this.db.collection<RoutineRuleDocument>("routine_rules");
  }

  private occurrences() {
    return this.db.collection<RoutineOccurrenceDocument>("routine_occurrences");
  }

  private async transaction<T>(
    work: (session: ClientSession) => Promise<T>
  ): Promise<T | "missing"> {
    const session = this.db.client.startSession();

    try {
      return await session.withTransaction(() => work(session));
    } catch (error) {
      if (error instanceof MissingDocumentError) {
        return "missing";
      }

      throw error;
    } finally {
      await session.endSession();
    }
  }
}

class MissingDocumentError extends Error {
  constructor() {
    super("Документ не найден");
    this.name = "MissingDocumentError";
  }
}

function ruleFilter(userId: string, id: string, includeDeleted: boolean) {
  const user = parseObjectId(userId);
  const ruleId = parseObjectId(id);

  if (!user || !ruleId) {
    return null;
  }

  return includeDeleted
    ? { _id: ruleId, userId: user }
    : { _id: ruleId, userId: user, deletedAt: null };
}

function occurrenceFilter(userId: string, id: string) {
  const user = parseObjectId(userId);
  const occurrenceId = parseObjectId(id);

  if (!user || !occurrenceId) {
    return null;
  }

  return { _id: occurrenceId, userId: user };
}

function ruleDocument(rule: RoutineRuleRecord): RoutineRuleDocument | null {
  const id = parseObjectId(rule.id);
  const userId = parseObjectId(rule.userId);

  if (!id || !userId) {
    return null;
  }

  return {
    _id: id,
    schemaVersion: 1,
    userId,
    title: rule.title,
    description: rule.description,
    startDate: rule.startDate,
    endDate: rule.endDate,
    recurrenceRule: toStoredRecurrence(rule.recurrence),
    reminderLocalTime: rule.reminderLocalTime,
    timezone: rule.timezone,
    status: rule.status,
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
    deletedAt: rule.deletedAt
  };
}

function ruleChanges(changes: RuleChanges, now: Date): MatchKeysAndValues<RoutineRuleDocument> {
  return {
    updatedAt: now,
    ...(changes.title !== undefined ? { title: changes.title } : {}),
    ...(changes.description !== undefined ? { description: changes.description } : {}),
    ...(changes.startDate !== undefined ? { startDate: changes.startDate } : {}),
    ...(changes.endDate !== undefined ? { endDate: changes.endDate } : {}),
    ...(changes.recurrence !== undefined
      ? { recurrenceRule: toStoredRecurrence(changes.recurrence) }
      : {}),
    ...(changes.reminderLocalTime !== undefined
      ? { reminderLocalTime: changes.reminderLocalTime }
      : {}),
    ...(changes.status !== undefined ? { status: changes.status } : {})
  };
}

function toRule(document: RoutineRuleDocument): RoutineRuleRecord {
  return {
    id: document._id.toHexString(),
    userId: document.userId.toHexString(),
    title: document.title,
    description: document.description,
    startDate: document.startDate,
    endDate: document.endDate,
    recurrence: fromStoredRecurrence(document.recurrenceRule),
    reminderLocalTime: document.reminderLocalTime,
    timezone: document.timezone,
    status: document.status,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    deletedAt: document.deletedAt
  };
}

function toOccurrence(document: RoutineOccurrenceDocument): RoutineOccurrenceRecord {
  return {
    id: document._id.toHexString(),
    userId: document.userId.toHexString(),
    ruleId: document.routineRuleId.toHexString(),
    localDate: document.localDate,
    titleOverride: document.titleOverride,
    status: document.status,
    completedAt: document.completedAt,
    excludedAt: document.excludedAt
  };
}
