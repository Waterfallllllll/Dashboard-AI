import { createCipheriv, createDecipheriv, createSecretKey, randomBytes } from "node:crypto";
import type { KeyObject } from "node:crypto";

const PREFIX = "enc:v1:";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;
const MAX_PLAINTEXT_BYTES = 4096;
const MAX_PAYLOAD_CHARS = 8192;

export const CREDENTIAL_PURPOSES = {
  accessToken: "auth_accounts.access_token",
  refreshToken: "auth_accounts.refresh_token",
  integrationCredentials: "integrations.credentials",
  pushKeys: "push_subscriptions.keys",
  oauthTransaction: "one_time_tokens.payload"
} as const;

export type CredentialPurpose = (typeof CREDENTIAL_PURPOSES)[keyof typeof CREDENTIAL_PURPOSES];

const PURPOSES = new Set<string>(Object.values(CREDENTIAL_PURPOSES));

export type CredentialCipherErrorCode =
  "invalid-key" | "invalid-plaintext" | "invalid-purpose" | "invalid-payload";

const ERROR_MESSAGES: Readonly<Record<CredentialCipherErrorCode, string>> = {
  "invalid-key": "DATA_ENCRYPTION_KEY не задан или не содержит 32 байта в base64 или hex",
  "invalid-plaintext": "Секрет пустой, уже зашифрован или длиннее допустимого",
  "invalid-purpose": "Неизвестное назначение шифрования",
  "invalid-payload": "Не удалось расшифровать секрет"
};

export class CredentialCipherError extends Error {
  readonly code: CredentialCipherErrorCode;

  constructor(code: CredentialCipherErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.name = "CredentialCipherError";
    this.code = code;
  }
}

export type CredentialCipher = {
  encrypt(plaintext: string, purpose: CredentialPurpose): string;
  decrypt(payload: string, purpose: CredentialPurpose): string;
};

export function readDataEncryptionKey(env: NodeJS.ProcessEnv = process.env): KeyObject {
  const raw = env.DATA_ENCRYPTION_KEY?.trim() ?? "";
  const bytes = decodeKeyMaterial(raw);

  try {
    if (bytes.length !== KEY_BYTES) {
      throw new CredentialCipherError("invalid-key");
    }

    return createSecretKey(Uint8Array.from(bytes));
  } finally {
    bytes.fill(0);
  }
}

export function createCredentialCipher(key: KeyObject): CredentialCipher {
  return {
    encrypt(plaintext, purpose) {
      return encryptSecret(key, plaintext, purpose);
    },
    decrypt(payload, purpose) {
      return decryptSecret(key, payload, purpose);
    }
  };
}

export function isEncryptedSecret(value: string): boolean {
  return parsePayload(value) !== null;
}

function encryptSecret(key: KeyObject, plaintext: string, purpose: CredentialPurpose): string {
  assertPurpose(purpose);
  const body = Buffer.from(plaintext, "utf8");

  try {
    if (body.length === 0 || body.length > MAX_PLAINTEXT_BYTES || isEncryptedSecret(plaintext)) {
      throw new CredentialCipherError("invalid-plaintext");
    }

    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(Buffer.from(purpose, "utf8"));
    const ciphertext = Buffer.concat([cipher.update(body), cipher.final()]);
    const tag = cipher.getAuthTag();
    const payload = `${PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`;

    if (payload.length > MAX_PAYLOAD_CHARS) {
      throw new CredentialCipherError("invalid-plaintext");
    }

    return payload;
  } finally {
    body.fill(0);
  }
}

function decryptSecret(key: KeyObject, payload: string, purpose: CredentialPurpose): string {
  assertPurpose(purpose);
  const parsed = parsePayload(payload);

  if (!parsed) {
    throw new CredentialCipherError("invalid-payload");
  }

  try {
    const decipher = createDecipheriv("aes-256-gcm", key, parsed.iv);
    decipher.setAAD(Buffer.from(purpose, "utf8"));
    decipher.setAuthTag(parsed.tag);
    const plaintext = Buffer.concat([decipher.update(parsed.ciphertext), decipher.final()]);

    try {
      return plaintext.toString("utf8");
    } finally {
      plaintext.fill(0);
    }
  } catch (error) {
    if (error instanceof CredentialCipherError) {
      throw error;
    }

    throw new CredentialCipherError("invalid-payload");
  }
}

function assertPurpose(purpose: string): asserts purpose is CredentialPurpose {
  if (!PURPOSES.has(purpose)) {
    throw new CredentialCipherError("invalid-purpose");
  }
}

function decodeKeyMaterial(raw: string): Buffer {
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  if (/^[A-Za-z0-9_-]{43}$/.test(raw)) {
    return Buffer.from(raw, "base64url");
  }

  if (/^[A-Za-z0-9+/]{43}=$/.test(raw)) {
    return Buffer.from(raw, "base64");
  }

  return Buffer.alloc(0);
}

type ParsedPayload = {
  readonly iv: Buffer;
  readonly tag: Buffer;
  readonly ciphertext: Buffer;
};

function parsePayload(payload: string): ParsedPayload | null {
  if (!payload.startsWith(PREFIX) || payload.length > MAX_PAYLOAD_CHARS) {
    return null;
  }

  const parts = payload.slice(PREFIX.length).split(".");

  if (parts.length !== 3) {
    return null;
  }

  const [ivPart, tagPart, cipherPart] = parts;

  if (!ivPart || !tagPart || !cipherPart) {
    return null;
  }

  if (!/^[A-Za-z0-9_-]+$/.test(`${ivPart}${tagPart}${cipherPart}`)) {
    return null;
  }

  const iv = Buffer.from(ivPart, "base64url");
  const tag = Buffer.from(tagPart, "base64url");
  const ciphertext = Buffer.from(cipherPart, "base64url");

  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES || ciphertext.length === 0) {
    return null;
  }

  if (ciphertext.length > MAX_PLAINTEXT_BYTES) {
    return null;
  }

  return { iv, tag, ciphertext };
}
