import { resolve } from "node:path";

import { config as loadEnv } from "dotenv";

const apiRoot = resolve(import.meta.dirname, "..");

// Значения, переданные платформой через process.env, всегда имеют приоритет.
// Workspace-файл остаётся необязательным локальным override, корневой .env —
// единым источником настроек для web, API, worker и Prisma.
loadEnv({ path: resolve(apiRoot, ".env") });
loadEnv({ path: resolve(apiRoot, "../../.env") });
