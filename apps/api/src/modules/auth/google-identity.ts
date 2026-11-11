import { localeSchema } from "@dashboard/contracts";

import { DEFAULT_DISPLAY_NAME } from "../../config/constants.js";

const SUBJECT_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const ALLOWED_SCOPES = new Set(["openid", "email", "profile"]);
const MAX_SECRET_LENGTH = 4096;

export type GoogleTokenSet = {
  readonly subject: unknown;
  readonly emailVerified: unknown;
  readonly name: unknown;
  readonly picture: unknown;
  readonly locale: unknown;
  readonly accessToken: unknown;
  readonly refreshToken: unknown;
  readonly expiresIn: unknown;
  readonly scope: unknown;
};

export type GoogleIdentity = {
  readonly subject: string;
  readonly displayName: string;
  readonly avatarUrl: string | null;
  readonly locale: string | null;
  readonly accessToken: string;
  readonly refreshToken: string | null;
  readonly expiresAt: Date | null;
  readonly scopes: readonly string[];
};

export function sanitizeAvatarUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) {
    return null;
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();

  if (
    url.protocol !== "https:" ||
    url.username !== "" ||
    url.password !== "" ||
    (host !== "googleusercontent.com" && !host.endsWith(".googleusercontent.com")) ||
    url.href.length > 2048
  ) {
    return null;
  }

  return url.href;
}

function visibleName(value: string): string {
  let cleaned = "";

  for (const char of value) {
    const code = char.charCodeAt(0);

    if (code <= 31 || code === 127 || char === "<" || char === ">") {
      continue;
    }

    cleaned += char;
  }

  return cleaned;
}

export function publicDisplayName(value: unknown): string {
  if (typeof value !== "string") {
    return DEFAULT_DISPLAY_NAME;
  }

  const cleaned = visibleName(value).trim().slice(0, 120);
  return cleaned.length > 0 ? cleaned : DEFAULT_DISPLAY_NAME;
}

export function readGoogleIdentity(
  input: GoogleTokenSet & { readonly now: Date }
): GoogleIdentity | null {
  if (typeof input.subject !== "string" || !SUBJECT_PATTERN.test(input.subject)) {
    return null;
  }

  if (input.emailVerified !== true) {
    return null;
  }

  const accessToken = readSecret(input.accessToken);

  if (!accessToken) {
    return null;
  }

  const refreshToken =
    input.refreshToken === undefined || input.refreshToken === null
      ? null
      : readSecret(input.refreshToken);

  if (refreshToken === null && input.refreshToken !== undefined && input.refreshToken !== null) {
    return null;
  }

  const locale =
    typeof input.locale === "string" && localeSchema.safeParse(input.locale).success
      ? input.locale
      : null;

  return {
    subject: input.subject,
    displayName: publicDisplayName(input.name),
    avatarUrl: sanitizeAvatarUrl(input.picture),
    locale,
    accessToken,
    refreshToken,
    expiresAt: readExpiry(input.expiresIn, input.now),
    scopes: normalizeScopes(input.scope)
  };
}

function readSecret(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > MAX_SECRET_LENGTH ||
    /\s/.test(value)
  ) {
    return null;
  }

  return value;
}

function readExpiry(value: unknown, now: Date): Date | null {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value <= 0 ||
    value > 60 * 60 * 24 * 366
  ) {
    return null;
  }

  return new Date(now.getTime() + value * 1000);
}

function normalizeScopes(value: unknown): string[] {
  if (typeof value !== "string") {
    return ["openid"];
  }

  const scopes = [...new Set(value.split(" ").filter((item) => ALLOWED_SCOPES.has(item)))];
  return scopes.length > 0 ? scopes : ["openid"];
}
