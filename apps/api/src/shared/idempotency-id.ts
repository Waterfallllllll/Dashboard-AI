import { deterministicEntityId } from "./public-id.js";

export function idempotencyObjectId(userId: string, scope: string, key: string): string {
  return deterministicEntityId(`${scope}\0${userId}\0${key}`);
}
