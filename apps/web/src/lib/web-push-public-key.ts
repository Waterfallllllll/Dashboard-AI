import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export function readServerWebPushPublicKey(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY?.trim() ||
    process.env.WEB_PUSH_PUBLIC_KEY?.trim();

  if (fromEnv) {
    return fromEnv;
  }

  for (const file of [
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "../../.env"),
    resolve(process.cwd(), "my-app/.env")
  ]) {
    const value = readEnvKey(file);

    if (value) {
      return value;
    }
  }

  return "";
}

function readEnvKey(file: string): string {
  try {
    const source = readFileSync(file, "utf8");
    return (
      source.match(/^NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY=(.*)$/m)?.[1]?.trim() ||
      source.match(/^WEB_PUSH_PUBLIC_KEY=(.*)$/m)?.[1]?.trim() ||
      ""
    );
  } catch {
    return "";
  }
}
