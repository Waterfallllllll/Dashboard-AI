import { MongoClient } from "mongodb";

const DEFAULT_DB_NAME = "dashboard";
const DEFAULT_POOL_SIZE = 20;
const CONNECT_ATTEMPTS = 3;

export type MongoConfig = {
  readonly uri: string;
  readonly dbName: string;
  readonly maxPoolSize: number;
};

export function readMongoConfig(env: NodeJS.ProcessEnv = process.env): MongoConfig {
  const uri = env.MONGODB_URI?.trim() ?? "";

  if (!uri.startsWith("mongodb://") && !uri.startsWith("mongodb+srv://")) {
    throw new Error("MONGODB_URI не задан или не является адресом MongoDB");
  }

  const dbName = env.MONGODB_DB_NAME?.trim() || DEFAULT_DB_NAME;

  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(dbName)) {
    throw new Error("MONGODB_DB_NAME содержит недопустимые символы");
  }

  const rawPoolSize = env.MONGODB_MAX_POOL_SIZE ?? String(DEFAULT_POOL_SIZE);
  const maxPoolSize = Number(rawPoolSize);

  if (!Number.isInteger(maxPoolSize) || maxPoolSize < 1 || maxPoolSize > 100) {
    throw new Error("MONGODB_MAX_POOL_SIZE должен быть целым числом от 1 до 100");
  }

  return { uri, dbName, maxPoolSize };
}

export async function connectMongo(config: MongoConfig): Promise<MongoClient> {
  let delayMs = 200;
  let lastCode = "";

  for (let attempt = 1; attempt <= CONNECT_ATTEMPTS; attempt += 1) {
    const client = new MongoClient(config.uri, {
      maxPoolSize: config.maxPoolSize,
      serverSelectionTimeoutMS: 8_000,
      timeoutMS: 10_000
    });

    try {
      await client.connect();
      return client;
    } catch (error) {
      await client.close().catch(() => undefined);
      lastCode = readErrorCode(error);

      if (attempt < CONNECT_ATTEMPTS) {
        await delay(delayMs);
        delayMs *= 2;
      }
    }
  }

  throw new Error(
    lastCode
      ? `Не удалось подключиться к MongoDB (code ${lastCode})`
      : "Не удалось подключиться к MongoDB"
  );
}

export async function closeMongo(client: MongoClient): Promise<void> {
  await client.close();
}

function readErrorCode(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = error.code;
    return typeof code === "string" || typeof code === "number" ? String(code) : "";
  }

  return "";
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
