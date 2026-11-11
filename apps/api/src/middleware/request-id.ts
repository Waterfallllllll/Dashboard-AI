import { randomBytes } from "node:crypto";

import { requestIdSchema } from "@dashboard/contracts";
import type { NextFunction, Request, Response } from "express";

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header("x-request-id");
  const requestIdValue =
    incoming && requestIdSchema.safeParse(incoming).success
      ? incoming
      : randomBytes(16).toString("base64url");
  req.requestId = requestIdValue;
  res.setHeader("X-Request-Id", requestIdValue);
  next();
}
