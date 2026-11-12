import type { Db, Document } from "mongodb";

import { getCollectionDefinition, type CollectionName } from "../collection-catalog.js";
import { ensureCollections } from "../ensure-collections.js";
import { ensureIndexes } from "../ensure-indexes.js";
import type { Migration } from "./types.js";

export const backgroundJobsMigration: Migration = {
  version: 4,
  name: "background-jobs",
  async up(db: Db) {
    await ensureCollections(db);
    await syncValidator(db, "users");
    await syncValidator(db, "integrations");
    await ensureIndexes(db);
  }
};

async function syncValidator(db: Db, name: CollectionName): Promise<void> {
  const definition = getCollectionDefinition(name);
  await db.command({
    collMod: name,
    validator: { $jsonSchema: definition.schema as Document },
    validationLevel: "strict",
    validationAction: "error"
  });
}
