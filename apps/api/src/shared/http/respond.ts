import type { Response } from "express";
import type { ZodType } from "zod";

export function sendParsed(res: Response, schema: ZodType, status: number, payload: unknown): void {
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json(schema.parse(payload));
}
