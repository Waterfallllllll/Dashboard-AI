import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";

import { closeMongo, connectMongo, readMongoConfig } from "./mongo-client.js";
import { runMigrations } from "./migrations/runner.js";

loadEnv({
  path: resolve(fileURLToPath(new URL("../../../../../.env", import.meta.url)))
});

const config = readMongoConfig();
const client = await connectMongo(config);

try {
  const result = await runMigrations(client.db(config.dbName));
  const applied = result.applied.length > 0 ? result.applied.join(", ") : "нет";
  const skipped = result.skipped.length > 0 ? result.skipped.join(", ") : "нет";
  process.stdout.write(`Миграции готовы. Применено: ${applied}. Уже были: ${skipped}.\n`);
} finally {
  await closeMongo(client);
}
