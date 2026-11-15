import { healthResponseSchema, sessionResponseSchema, type Session } from "@dashboard/contracts";
import { cache } from "react";

import { serverApi } from "@/lib/api/server-api-client";

const SESSION_TIMEOUT_MS = 1_200;

export const readSession = cache(async (): Promise<Session | null> => {
  const result = await serverApi({
    path: "/api/v1/auth/session",
    schema: sessionResponseSchema,
    timeoutMs: SESSION_TIMEOUT_MS
  });

  if (!result.ok) {
    return null;
  }

  return result.data.data;
});

export async function isApiReachable(): Promise<boolean> {
  const result = await serverApi({
    path: "/health/live",
    schema: healthResponseSchema,
    timeoutMs: 800
  });

  return result.ok && result.data.data.status === "live";
}
