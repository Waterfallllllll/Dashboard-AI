import { entityIdSchema, idempotencyKeySchema } from "@dashboard/contracts";
import type { Request } from "express";

import { parseRequest } from "../errors/api-error.js";

export function readIdempotencyKey(req: Request): string | null {
  const header = req.header("Idempotency-Key");

  if (header === undefined) {
    return null;
  }

  return parseRequest(idempotencyKeySchema, header);
}

export function readRouteId(req: Request): string {
  const raw = req.params.id;
  return parseRequest(entityIdSchema, Array.isArray(raw) ? raw[0] : raw);
}
