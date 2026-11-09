import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";

import { ensureCollections } from "./ensure-collections.js";
import { closeMongo, connectMongo, readMongoConfig } from "./mongo-client.js";

loadEnv({
  path: resolve(fileURLToPath(new URL("../../../../../.env", import.meta.url)))
});

const config = readMongoConfig();
const client = await connectMongo(config);

try {
  const result = await ensureCollections(client.db(config.dbName));
  process.stdout.write(
    `Коллекции готовы. Создано: ${result.created.length}. Уже были: ${result.existing.length}.\n`
  );
} finally {
  await closeMongo(client);
}
