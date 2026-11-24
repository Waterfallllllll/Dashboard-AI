import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const envPath = new URL("../.env", import.meta.url);
const newline = process.platform === "win32" ? "\r\n" : "\n";

let source = await readFile(envPath, "utf8");
const updated = [];

source = ensureSecret(source, "SESSION_SECRET", validSessionSecret, () =>
  randomBytes(32).toString("hex")
);
source = ensureSecret(source, "DATA_ENCRYPTION_KEY", validEncryptionKey, () =>
  randomBytes(32).toString("hex")
);

if (updated.length > 0) {
  await writeFile(envPath, source, "utf8");
}

process.stdout.write(
  updated.length === 0
    ? "Локальные секреты уже настроены.\n"
    : `Созданы локальные секреты: ${updated.join(", ")}.\n`
);

function ensureSecret(contents, name, valid, generate) {
  const pattern = new RegExp(`^${name}=(.*)$`, "m");
  const match = contents.match(pattern);
  const current = match?.[1]?.trim() ?? "";

  if (valid(current)) {
    return contents;
  }

  const line = `${name}=${generate()}`;
  updated.push(name);

  if (match) {
    return contents.replace(pattern, line);
  }

  const suffix = contents.endsWith("\n") || contents.endsWith("\r") ? "" : newline;
  return `${contents}${suffix}${line}${newline}`;
}

function validSessionSecret(value) {
  return value.length >= 32 && !/\s/.test(value);
}

function validEncryptionKey(value) {
  if (/^[\da-f]{64}$/i.test(value)) {
    return true;
  }

  return /^[A-Za-z0-9+/]+={0,2}$/.test(value) && Buffer.from(value, "base64").length === 32;
}
