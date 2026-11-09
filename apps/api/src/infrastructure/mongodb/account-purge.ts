import { ObjectId, type Db, type Filter, type Document } from "mongodb";

import {
  assertStoredCollections,
  USER_OWNED_COLLECTIONS,
  type UserOwnedCollection
} from "./user-data.js";

export type PurgeDeletedCounts = Record<UserOwnedCollection | "users", number>;

export type PurgeResult = {
  readonly user: "purged" | "missing";
  readonly deleted: PurgeDeletedCounts;
};

export class AccountStillActiveError extends Error {
  readonly code = "ACCOUNT_STILL_ACTIVE" as const;

  constructor() {
    super("Активный аккаунт не удаляется физически. Сначала нужно мягкое удаление.");
    this.name = "AccountStillActiveError";
  }
}

export function assertPurgeUserId(userId: ObjectId): void {
  // Пустой фильтр удалил бы коллекцию целиком, поэтому идентификатор только ObjectId.
  if (!(userId instanceof ObjectId)) {
    throw new Error("Очистка аккаунта принимает только ObjectId");
  }
}

export function assertAccountPurgeAllowed(
  user: { readonly deletedAt: Date | null } | null
): "soft-deleted" | "missing" {
  if (!user) {
    return "missing";
  }

  if (!(user.deletedAt instanceof Date) || Number.isNaN(user.deletedAt.getTime())) {
    throw new AccountStillActiveError();
  }

  return "soft-deleted";
}

export async function purgeAccount(db: Db, userId: ObjectId): Promise<PurgeResult> {
  assertPurgeUserId(userId);
  await assertStoredCollections(db);
  const ownedByUser: Filter<Document> = { userId };
  const session = db.client.startSession();

  try {
    return await session.withTransaction(async (): Promise<PurgeResult> => {
      const user = await db
        .collection<{ deletedAt: Date | null }>("users")
        .findOne({ _id: userId }, { projection: { deletedAt: 1 }, session });
      const state = assertAccountPurgeAllowed(user);
      const deleted = emptyDeleted();

      for (const name of USER_OWNED_COLLECTIONS) {
        const result = await db.collection(name).deleteMany(ownedByUser, { session });
        deleted[name] = result.deletedCount;
      }

      if (state === "soft-deleted") {
        const result = await db
          .collection("users")
          .deleteOne({ _id: userId, deletedAt: { $type: "date" } }, { session });
        deleted.users = result.deletedCount;

        if (result.deletedCount !== 1) {
          throw new Error("Документ аккаунта изменился во время очистки");
        }
      }

      return {
        user: state === "soft-deleted" ? "purged" : "missing",
        deleted: { ...deleted }
      };
    });
  } finally {
    await session.endSession();
  }
}

function emptyDeleted(): PurgeDeletedCounts {
  return {
    users: 0,
    auth_accounts: 0,
    sessions: 0,
    dashboard_configs: 0,
    routine_rules: 0,
    routine_occurrences: 0,
    timer_sessions: 0,
    integrations: 0,
    push_subscriptions: 0,
    notification_deliveries: 0
  };
}
