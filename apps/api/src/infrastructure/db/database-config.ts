const POOL_MAX = 10;
const STATEMENT_TIMEOUT_MS = 10_000;
const CONNECT_TIMEOUT_MS = 8_000;

export type DatabaseConfig = {
  readonly connectionString: string;
  readonly poolMax: number;
  readonly statementTimeoutMs: number;
  readonly connectTimeoutMs: number;
};

export function readDatabaseConfig(env: NodeJS.ProcessEnv = process.env): DatabaseConfig {
  return {
    connectionString: readConnectionString(env.DATABASE_URL),
    poolMax: POOL_MAX,
    statementTimeoutMs: STATEMENT_TIMEOUT_MS,
    connectTimeoutMs: CONNECT_TIMEOUT_MS
  };
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
