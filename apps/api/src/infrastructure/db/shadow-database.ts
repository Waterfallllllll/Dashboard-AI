import { Client } from "pg";

const SHADOW_DATABASE_NAME = "dashboard_shadow";

export function shadowDatabaseUrl(directUrl: string, env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.SHADOW_DATABASE_URL?.trim();
  if (configured) {
    return configured;
  }

  const url = new URL(directUrl);
  url.pathname = `/${SHADOW_DATABASE_NAME}`;
  return url.toString();
}

export async function ensureShadowDatabase(
  directUrl: string,
  env: NodeJS.ProcessEnv = process.env
): Promise<void> {
  const databaseName = shadowDatabaseName(shadowDatabaseUrl(directUrl, env));
  const client = new Client({ connectionString: directUrl });

  try {
    await client.connect();
    const existing = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [
      databaseName
    ]);
    if ((existing.rowCount ?? 0) > 0) {
      return;
    }

    await client.query(`CREATE DATABASE "${databaseName}"`);
  } catch (error) {
    if (isDuplicateDatabase(error)) {
      return;
    }

    throw error;
  } finally {
    await client.end();
  }
}

function shadowDatabaseName(shadowUrl: string): string {
  const name = decodeURIComponent(new URL(shadowUrl).pathname.replace(/^\//, ""));
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error("Имя shadow-базы Prisma должно состоять из букв, цифр и подчёркивания");
  }

  return name;
}

function isDuplicateDatabase(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "42P04";
}
