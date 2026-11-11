import type { Request, Response } from "express";

import { SESSION_COOKIE } from "../../config/constants.js";

const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43,128}$/;

const cookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/"
};

export function setSessionCookie(res: Response, token: string, maxAgeMs: number): void {
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions, maxAge: maxAgeMs });
}

export function clearSessionCookie(res: Response): void {
  res.cookie(SESSION_COOKIE, "", { ...cookieOptions, maxAge: 0 });
}

export function readSessionCookie(req: Request): string | null {
  const raw: unknown = req.cookies?.[SESSION_COOKIE];

  if (typeof raw !== "string" || !SESSION_TOKEN_PATTERN.test(raw)) {
    return null;
  }

  return raw;
}
