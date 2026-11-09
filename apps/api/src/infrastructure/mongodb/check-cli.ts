import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";

import { checkDatabase, formatDatabaseCheck } from "./check-database.js";
import { closeMongo, connectMongo, readMongoConfig } from "./mongo-client.js";

loadEnv({
  path: resolve(fileURLToPath(new URL("../../../../../.env", import.meta.url)))
});

const config = readMongoConfig();
const client = await connectMongo(config);

try {
  const report = await checkDatabase(client.db(config.dbName));
  process.stdout.write(formatDatabaseCheck(report));

  if (!report.ok) {
    process.exitCode = 1;
  }
} finally {
  await closeMongo(client);
}
