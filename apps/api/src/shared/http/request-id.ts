import { requestIdSchema } from "@dashboard/contracts";
import type { Request } from "express";

const FALLBACK_REQUEST_ID = "unknown-request";

export function requestIdFrom(req: Request): string {
  return typeof req.requestId === "string" && requestIdSchema.safeParse(req.requestId).success
    ? req.requestId
    : FALLBACK_REQUEST_ID;
}
