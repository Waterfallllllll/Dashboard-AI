import { z } from "zod";

import { apiSuccessSchema } from "../common/api-response.js";
import { utcDateTimeSchema } from "../common/primitives.js";
import { profileSchema } from "./profile.js";

const csrfTokenPattern = /^[A-Za-z0-9_-]{43,128}$/;

export const CSRF_HEADER = "X-CSRF-Token";

export const sessionSchema = z.strictObject({
  user: profileSchema,
  expiresAt: utcDateTimeSchema,
  csrfToken: z.string().regex(csrfTokenPattern, { error: "Некорректный токен защиты." })
});

export const signOutSchema = z.strictObject({
  signedOut: z.literal(true)
});

export const sessionResponseSchema = apiSuccessSchema(sessionSchema);
export const signOutResponseSchema = apiSuccessSchema(signOutSchema);

export type Session = z.infer<typeof sessionSchema>;
