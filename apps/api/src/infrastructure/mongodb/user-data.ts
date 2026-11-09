import type { Db } from "mongodb";

import { COLLECTION_NAMES, type CollectionName } from "./collection-catalog.js";

export const USER_OWNED_COLLECTIONS = [
  "auth_accounts",
  "sessions",
  "dashboard_configs",
  "routine_rules",
  "routine_occurrences",
  "timer_sessions",
  "integrations",
  "push_subscriptions",
  "notification_deliveries"
] as const satisfies readonly CollectionName[];

export type UserOwnedCollection = (typeof USER_OWNED_COLLECTIONS)[number];

export const GLOBAL_COLLECTIONS = ["news_items"] as const satisfies readonly CollectionName[];

export function assertUserDataCoverage(collections: readonly string[] = COLLECTION_NAMES): void {
  const covered = new Set<string>(["users", ...USER_OWNED_COLLECTIONS, ...GLOBAL_COLLECTIONS]);
  const actual = new Set(collections);

  if (actual.size !== collections.length) {
    throw new Error("В каталоге коллекций есть повторы");
  }

  for (const name of covered) {
    if (!actual.has(name)) {
      throw new Error(`Коллекция ${name} пропала из каталога`);
    }
  }

  for (const name of actual) {
    if (!covered.has(name)) {
      throw new Error(`Коллекция ${name} не отнесена ни к пользователю, ни к общему кэшу`);
    }
  }

  if ((USER_OWNED_COLLECTIONS as readonly string[]).includes("news_items")) {
    throw new Error("Общий кэш новостей нельзя удалять вместе с аккаунтом");
  }
}

export async function assertStoredCollections(db: Db): Promise<void> {
  const existing = new Set(
    (await db.listCollections({}, { nameOnly: true }).toArray()).map((item) => item.name)
  );

  for (const name of COLLECTION_NAMES) {
    if (!existing.has(name)) {
      throw new Error(`Коллекция ${name} не создана. Сначала нужна миграция.`);
    }
  }
}
