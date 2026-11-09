import type { Collection, Filter, MatchKeysAndValues, ObjectId } from "mongodb";

export const activeDocumentFilter = { deletedAt: null } as const;

export type SoftDeletableDocument = {
  deletedAt: Date | null;
  updatedAt: Date;
};

export type SoftDeleteResult = "deleted" | "already-deleted" | "missing";
export type RestoreResult = "restored" | "already-active" | "missing";

export function softDeleteFields(now: Date): { deletedAt: Date; updatedAt: Date } {
  assertTimestamp(now);
  return { deletedAt: now, updatedAt: now };
}

export function restoreFields(now: Date): { deletedAt: null; updatedAt: Date } {
  assertTimestamp(now);
  return { deletedAt: null, updatedAt: now };
}

export async function softDeleteById<T extends SoftDeletableDocument>(
  collection: Collection<T>,
  id: ObjectId,
  now: Date
): Promise<SoftDeleteResult> {
  const updated = await collection.updateOne(idFilter<T>(id, { deletedAt: null }), {
    $set: softDeleteFields(now) as MatchKeysAndValues<T>
  });

  if (updated.matchedCount === 1) {
    return "deleted";
  }

  const found = await collection.findOne(idFilter<T>(id), { projection: { _id: 1 } });
  return found ? "already-deleted" : "missing";
}

export async function restoreSoftDeletedById<T extends SoftDeletableDocument>(
  collection: Collection<T>,
  id: ObjectId,
  now: Date
): Promise<RestoreResult> {
  const updated = await collection.updateOne(idFilter<T>(id, { deletedAt: { $type: "date" } }), {
    $set: restoreFields(now) as MatchKeysAndValues<T>
  });

  if (updated.matchedCount === 1) {
    return "restored";
  }

  const found = await collection.findOne(idFilter<T>(id), { projection: { _id: 1 } });
  return found ? "already-active" : "missing";
}

function idFilter<T extends SoftDeletableDocument>(
  id: ObjectId,
  extra: Readonly<Record<string, unknown>> = {}
): Filter<T> {
  return { _id: id, ...extra } as Filter<T>;
}

function assertTimestamp(now: Date): void {
  if (Number.isNaN(now.getTime())) {
    throw new Error("Некорректная метка времени мягкого удаления");
  }
}
