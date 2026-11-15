import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";

import { checkDatabase, formatDatabaseCheck } from "./check-database.js";
import { connectDatabase, disconnectPrisma, getPrismaClient } from "./prisma-client.js";

loadEnv({
  path: resolve(fileURLToPath(new URL("../../../../../.env", import.meta.url)))
});

await connectDatabase();

try {
  const report = await checkDatabase(getPrismaClient());
  process.stdout.write(formatDatabaseCheck(report));

  if (!report.ok) {
    process.exitCode = 1;
  }
} finally {
  await disconnectPrisma();
}
