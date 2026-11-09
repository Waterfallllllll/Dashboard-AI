import type { CreateIndexesOptions, Db, Document } from "mongodb";

import {
  INDEX_DEFINITIONS,
  assertIndexCatalog,
  type IndexDefinition,
  type PartialFilter
} from "./index-catalog.js";

export type EnsureIndexesResult = {
  readonly ensured: readonly string[];
};

export async function ensureIndexes(db: Db): Promise<EnsureIndexesResult> {
  assertIndexCatalog();
  const existing = new Set(
    (await db.listCollections({}, { nameOnly: true }).toArray()).map(
      (collection) => collection.name
    )
  );
  const ensured: string[] = [];

  for (const index of INDEX_DEFINITIONS) {
    if (!existing.has(index.collection)) {
      throw new Error(`Коллекция ${index.collection} не создана. Сначала нужны валидаторы.`);
    }

    await db.collection(index.collection).createIndex(indexKey(index), indexOptions(index));
    ensured.push(index.name);
  }

  return { ensured };
}

function indexKey(index: IndexDefinition): Record<string, 1 | -1> {
  return { ...index.key };
}

function indexOptions(index: IndexDefinition): CreateIndexesOptions {
  const options: CreateIndexesOptions = { name: index.name };

  if (index.kind === "unique") {
    options.unique = true;
  }

  if (index.kind === "ttl") {
    options.expireAfterSeconds = index.expireAfterSeconds;
  }

  if (index.kind !== "ttl" && index.partialFilterExpression) {
    options.partialFilterExpression = partialFilter(index.partialFilterExpression);
  }

  return options;
}

function partialFilter(filter: PartialFilter): Document {
  return { ...filter };
}
