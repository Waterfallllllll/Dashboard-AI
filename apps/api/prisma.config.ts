import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

import { defineConfig } from "prisma/config";

import { shadowDatabaseUrl } from "./src/infrastructure/db/shadow-database.ts";

loadEnv({ path: resolve(import.meta.dirname, ".env") });
loadEnv({ path: resolve(import.meta.dirname, "../../.env") });

// Заглушка без пароля нужна только generate и validate, когда адрес ещё не задан.
// migrate и runtime берут DIRECT_DATABASE_URL или DATABASE_URL и не используют этот адрес.
// migrate diff проигрывает каталог миграций в shadow-базу и не должен затирать рабочую.
const directUrl =
  process.env.DIRECT_DATABASE_URL?.trim() ||
  process.env.DATABASE_URL?.trim() ||
  "postgresql://127.0.0.1:5432/dashboard";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations"
  },
  datasource: {
    url: directUrl,
    shadowDatabaseUrl: shadowDatabaseUrl(directUrl)
  }
});
