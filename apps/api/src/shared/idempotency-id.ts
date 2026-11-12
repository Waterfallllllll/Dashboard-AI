import { createHash } from "node:crypto";

import { ObjectId } from "mongodb";

export function idempotencyObjectId(userId: string, scope: string, key: string): string {
  const digest = createHash("sha256").update(`${scope}\0${userId}\0${key}`).digest();
  return new ObjectId(digest.subarray(0, 12)).toHexString();
}
