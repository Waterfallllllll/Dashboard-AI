import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { PrismaClient } from "../../generated/prisma/client.js";
import { readDatabaseConfig } from "./database-config.js";

const CONNECT_ATTEMPTS = 3;

const PERMANENT_CODES = new Set(["28P01", "28000", "3D000", "42501", "42601"]);

type PrismaStore = {
  prisma: PrismaClient | undefined;
};

const globalStore = globalThis as typeof globalThis & {
  __dashboardPrisma?: PrismaStore;
};

function store(): PrismaStore {
  globalStore.__dashboardPrisma ??= { prisma: undefined };
  return globalStore.__dashboardPrisma;
}

export function getPrismaClient(env: NodeJS.ProcessEnv = process.env): PrismaClient {
  const current = store();
  if (current.prisma) {
    return current.prisma;
  }

  const config = readDatabaseConfig(env);
  const pool = new Pool({
    connectionString: config.connectionString,
    max: config.poolMax,
    connectionTimeoutMillis: config.connectTimeoutMs,
    statement_timeout: config.statementTimeoutMs,
    query_timeout: config.statementTimeoutMs,
    idle_in_transaction_session_timeout: config.idleInTransactionTimeoutMs,
    options: `-c work_mem=${config.workMem}`,
    application_name: "evergreen-dashboard"
  });
  const client = new PrismaClient({
    adapter: new PrismaPg(pool, {
      disposeExternalPool: true,
      onPoolError: () => undefined
    }),
    errorFormat: "minimal"
  });
  current.prisma = client;
  return client;
}

export async function disconnectPrisma(): Promise<void> {
  const current = store();
  const client = current.prisma;
  current.prisma = undefined;

  if (client) {
    await client.$disconnect();
  }
}

export async function pingDatabase(client: PrismaClient = getPrismaClient()): Promise<boolean> {
  try {
    await client.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

export async function connectDatabase(client: PrismaClient = getPrismaClient()): Promise<void> {
  await connectWithRetries(() => client.$queryRaw`SELECT 1`.then(() => undefined));
}

export async function connectWithRetries(
  run: () => Promise<void>,
  options?: {
    readonly attempts?: number;
    readonly delay?: (ms: number) => Promise<void>;
  }
): Promise<void> {
  const attempts = options?.attempts ?? CONNECT_ATTEMPTS;
  const wait = options?.delay ?? delay;
  let lastCode = "";
  let delayMs = 200;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await run();
      return;
    } catch (error) {
      lastCode = readErrorCode(error);

      if (!isTransient(lastCode) || attempt === attempts) {
        break;
      }

      await wait(delayMs);
      delayMs *= 2;
    }
  }

  throw new Error(
    lastCode === ""
      ? "Не удалось подключиться к PostgreSQL"
      : `Не удалось подключиться к PostgreSQL (code ${lastCode})`
  );
}

function isTransient(code: string): boolean {
  return !PERMANENT_CODES.has(code);
}

function readErrorCode(error: unknown): string {
  const seen = new Set<unknown>();
  let current: unknown = error;

  while (typeof current === "object" && current !== null && !seen.has(current)) {
    seen.add(current);

    if ("code" in current) {
      const code = current.code;

      if (typeof code === "string" && code !== "") {
        return code;
      }
    }

    current = "cause" in current ? current.cause : undefined;
  }

  return "";
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
