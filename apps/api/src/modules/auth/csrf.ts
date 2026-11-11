import { createHmac, timingSafeEqual } from "node:crypto";

export function csrfTokenFor(sessionToken: string, secret: string): string {
  return createHmac("sha256", secret).update(sessionToken).digest("base64url");
}

export function csrfTokensMatch(provided: string, expected: string): boolean {
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);

  if (left.length === 0 || left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}
