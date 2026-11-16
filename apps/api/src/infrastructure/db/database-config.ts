const POOL_MAX = 10;
const STATEMENT_TIMEOUT_MS = 10_000;
const IDLE_IN_TRANSACTION_TIMEOUT_MS = 30_000;
const CONNECT_TIMEOUT_MS = 8_000;
const WORK_MEM = "8MB";
const WORK_MEM_PATTERN = /^\d+(?:kB|MB|GB)$/;

export type DatabaseConfig = {
  readonly connectionString: string;
  readonly poolMax: number;
  readonly statementTimeoutMs: number;
  readonly idleInTransactionTimeoutMs: number;
  readonly connectTimeoutMs: number;
  readonly workMem: string;
};

export function readDatabaseConfig(env: NodeJS.ProcessEnv = process.env): DatabaseConfig {
  return {
    connectionString: readConnectionString(env.DATABASE_URL),
    poolMax: POOL_MAX,
    statementTimeoutMs: STATEMENT_TIMEOUT_MS,
    idleInTransactionTimeoutMs: IDLE_IN_TRANSACTION_TIMEOUT_MS,
    connectTimeoutMs: CONNECT_TIMEOUT_MS,
    workMem: readWorkMem(WORK_MEM)
  };
}

function readWorkMem(value: string): string {
  if (!WORK_MEM_PATTERN.test(value)) {
    throw new Error("work_mem задан неверно");
  }

  return value;
}

function readConnectionString(value: string | undefined): string {
  const raw = value?.trim() ?? "";
  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    throw new Error("DATABASE_URL должен быть адресом PostgreSQL");
  }

  const protocol = url.protocol;
  const databaseName = url.pathname.replace(/^\//, "");

  if (
    (protocol !== "postgresql:" && protocol !== "postgres:") ||
    url.hostname === "" ||
    databaseName === "" ||
    url.hash !== ""
  ) {
    throw new Error("DATABASE_URL должен быть адресом PostgreSQL");
  }

  return raw;
}
