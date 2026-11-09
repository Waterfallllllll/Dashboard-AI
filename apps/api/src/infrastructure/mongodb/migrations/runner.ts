import type { Db, Document } from "mongodb";

import { MIGRATIONS, planMigrations } from "./registry.js";

export const SCHEMA_MIGRATIONS_COLLECTION = "schema_migrations";
export const SCHEMA_MIGRATIONS_VERSION_INDEX = "schema_migrations_version";

const NAMESPACE_EXISTS = 48;
const DUPLICATE_KEY = 11000;

const ledgerSchema: Document = {
  bsonType: "object",
  additionalProperties: false,
  required: ["version", "name", "appliedAt"],
  properties: {
    _id: { bsonType: "objectId" },
    version: { bsonType: "number", minimum: 1 },
    name: { bsonType: "string", minLength: 1, maxLength: 80 },
    appliedAt: { bsonType: "date" }
  }
};

export type MigrateResult = {
  readonly applied: readonly number[];
  readonly skipped: readonly number[];
};

export async function runMigrations(
  db: Db,
  now: () => Date = () => new Date()
): Promise<MigrateResult> {
  await ensureLedger(db);
  const recorded = await db
    .collection(SCHEMA_MIGRATIONS_COLLECTION)
    .find({}, { projection: { version: 1, _id: 0 } })
    .toArray();
  const appliedVersions = recorded.map((entry) => {
    if (typeof entry.version !== "number" || !Number.isInteger(entry.version)) {
      throw new Error("Некорректная запись schema_migrations");
    }

    return entry.version;
  });
  const plan = planMigrations(appliedVersions, MIGRATIONS);
  const applied: number[] = [];

  for (const migration of plan.apply) {
    await migration.up(db);

    try {
      await db.collection(SCHEMA_MIGRATIONS_COLLECTION).insertOne({
        version: migration.version,
        name: migration.name,
        appliedAt: now()
      });
    } catch (error) {
      if (!hasMongoCode(error, DUPLICATE_KEY)) {
        throw error;
      }
    }

    applied.push(migration.version);
  }

  return {
    applied,
    skipped: plan.skip.map((migration) => migration.version)
  };
}

async function ensureLedger(db: Db): Promise<void> {
  const found = (
    await db.listCollections({ name: SCHEMA_MIGRATIONS_COLLECTION }, { nameOnly: true }).toArray()
  ).some((collection) => collection.name === SCHEMA_MIGRATIONS_COLLECTION);

  if (!found) {
    try {
      await db.createCollection(SCHEMA_MIGRATIONS_COLLECTION, {
        validator: { $jsonSchema: ledgerSchema },
        validationLevel: "strict",
        validationAction: "error"
      });
    } catch (error) {
      if (!hasMongoCode(error, NAMESPACE_EXISTS)) {
        throw error;
      }
    }
  }

  await db
    .collection(SCHEMA_MIGRATIONS_COLLECTION)
    .createIndex({ version: 1 }, { name: SCHEMA_MIGRATIONS_VERSION_INDEX, unique: true });
}

function hasMongoCode(error: unknown, code: number): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
