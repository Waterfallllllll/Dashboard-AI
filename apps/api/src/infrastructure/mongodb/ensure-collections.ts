import type { Db, Document } from "mongodb";

import { COLLECTION_DEFINITIONS, type CollectionName } from "./collection-catalog.js";

const NAMESPACE_EXISTS = 48;

export type EnsureCollectionsResult = {
  readonly created: readonly CollectionName[];
  readonly existing: readonly CollectionName[];
};

export async function ensureCollections(db: Db): Promise<EnsureCollectionsResult> {
  const found = new Set(
    (await db.listCollections({}, { nameOnly: true }).toArray()).map(
      (collection) => collection.name
    )
  );
  const created: CollectionName[] = [];
  const existing: CollectionName[] = [];

  for (const definition of COLLECTION_DEFINITIONS) {
    if (found.has(definition.name)) {
      existing.push(definition.name);
      continue;
    }

    try {
      await db.createCollection(definition.name, {
        validator: { $jsonSchema: definition.schema as Document },
        validationLevel: "strict",
        validationAction: "error"
      });
      created.push(definition.name);
    } catch (error) {
      if (!isNamespaceExists(error)) {
        throw error;
      }

      existing.push(definition.name);
    }
  }

  return { created, existing };
}

function isNamespaceExists(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === NAMESPACE_EXISTS
  );
}
