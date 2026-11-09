import { MongoClient } from "mongodb";
import { afterAll, describe, expect, it } from "vitest";

import { COLLECTION_NAMES } from "./collection-catalog.js";
import { ensureCollections } from "./ensure-collections.js";

const mongoUri = process.env.MONGODB_URI ?? "";
const testDatabaseName = "dashboard_collection_test";

describe.skipIf(mongoUri === "")("коллекции в MongoDB", () => {
  let client: MongoClient | undefined;

  afterAll(async () => {
    if (!client) {
      return;
    }

    await client.db(testDatabaseName).dropDatabase();
    await client.close();
  });

  it("создаёт коллекции один раз и проверяет форму пользователя", async () => {
    client = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 2_000 });
    await client.connect();
    const db = client.db(testDatabaseName);
    await db.dropDatabase();

    const created = await ensureCollections(db);
    const repeated = await ensureCollections(db);

    expect(created.created).toEqual([...COLLECTION_NAMES]);
    expect(repeated.created).toEqual([]);
    expect(repeated.existing).toEqual([...COLLECTION_NAMES]);

    await expect(db.collection("users").insertOne({ schemaVersion: 1 })).rejects.toMatchObject({
      code: 121
    });

    await expect(
      db.collection("users").insertOne({
        schemaVersion: 1,
        displayName: "Аня",
        avatarUrl: null,
        locale: "ru",
        timezone: "Europe/Moscow",
        timeFormat: "24",
        theme: "system",
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null
      })
    ).resolves.toHaveProperty("acknowledged", true);
  });
});
