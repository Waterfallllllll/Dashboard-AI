import type { MatchKeysAndValues } from "mongodb";
import type { Db, ObjectId } from "mongodb";

import type { UserDocument } from "../../infrastructure/mongodb/collection-catalog.js";
import {
  restoreSoftDeletedById,
  softDeleteById,
  type SoftDeleteResult
} from "../../infrastructure/mongodb/soft-delete.js";
import { parseObjectId } from "../../shared/object-id.js";
import { toUserProfile, type ProfileUpdate, type UserProfile } from "./user-profile.js";

export type UsersRepository = {
  findActive(userId: string): Promise<UserProfile | null>;
  update(userId: string, patch: ProfileUpdate, now: Date): Promise<UserProfile | null>;
  softDelete(userId: string, now: Date): Promise<SoftDeleteResult>;
  restore(userId: string, now: Date): Promise<void>;
};

export function activeUserFilter(id: ObjectId): { _id: ObjectId; deletedAt: null } {
  return { _id: id, deletedAt: null };
}

export class MongoUsersRepository implements UsersRepository {
  constructor(private readonly db: Db) {}

  async findActive(userId: string): Promise<UserProfile | null> {
    const id = parseObjectId(userId);

    if (!id) {
      return null;
    }

    const document = await this.collection().findOne(activeUserFilter(id));
    return document ? toUserProfile(document) : null;
  }

  async update(userId: string, patch: ProfileUpdate, now: Date): Promise<UserProfile | null> {
    const id = parseObjectId(userId);

    if (!id) {
      return null;
    }

    const document = await this.collection().findOneAndUpdate(
      activeUserFilter(id),
      { $set: profileFields(patch, now) },
      { returnDocument: "after" }
    );

    return document ? toUserProfile(document) : null;
  }

  async softDelete(userId: string, now: Date): Promise<SoftDeleteResult> {
    const id = parseObjectId(userId);

    if (!id) {
      return "missing";
    }

    return softDeleteById(this.collection(), id, now);
  }

  async restore(userId: string, now: Date): Promise<void> {
    const id = parseObjectId(userId);

    if (!id) {
      return;
    }

    await restoreSoftDeletedById(this.collection(), id, now);
  }

  private collection() {
    return this.db.collection<UserDocument>("users");
  }
}

function profileFields(patch: ProfileUpdate, now: Date): MatchKeysAndValues<UserDocument> {
  return {
    updatedAt: now,
    ...(patch.displayName !== undefined ? { displayName: patch.displayName } : {}),
    ...(patch.locale !== undefined ? { locale: patch.locale } : {}),
    ...(patch.timezone !== undefined ? { timezone: patch.timezone } : {}),
    ...(patch.timeFormat !== undefined ? { timeFormat: patch.timeFormat } : {}),
    ...(patch.theme !== undefined ? { theme: patch.theme } : {})
  };
}
