import { randomBytes } from "node:crypto";

import { CalendarAccessRevokedError } from "./calendar-model.js";
import type { CalendarCredentials, CalendarWatchGateway } from "./google-calendar-gateway.js";
import { ProviderUnavailableError } from "../../infrastructure/http/provider-guard.js";

const RENEW_WITHIN_MS = 24 * 60 * 60 * 1000;
const WATCH_TTL_MS = 6 * 24 * 60 * 60 * 1000;

export type WatchTarget = {
  readonly userId: string;
  readonly channelId: string | null;
  readonly resourceId: string | null;
  readonly expiresAt: Date | null;
  readonly credentials: CalendarCredentials | null;
};

export function watchExpiresSoon(expiresAt: Date | null, now: Date): boolean {
  if (!expiresAt) {
    return true;
  }

  return expiresAt.getTime() - now.getTime() < RENEW_WITHIN_MS;
}

export async function renewCalendarWatches(input: {
  readonly webhookUrl: string | null;
  readonly webhookToken: string | null;
  readonly now: Date;
  readonly targets: readonly WatchTarget[];
  readonly gateway: CalendarWatchGateway;
  readonly save: (
    userId: string,
    watch: { channelId: string; resourceId: string; expiresAt: Date }
  ) => Promise<void>;
  readonly markRevoked: (userId: string) => Promise<void>;
}): Promise<number> {
  if (!input.webhookUrl || !input.webhookToken) {
    return 0;
  }

  let renewed = 0;

  for (const target of input.targets) {
    if (!target.credentials || !watchExpiresSoon(target.expiresAt, input.now)) {
      continue;
    }

    if (target.channelId && target.resourceId) {
      try {
        await input.gateway.stop(target.credentials, target.channelId, target.resourceId);
      } catch {
        // Старый канал мог уже истечь. Новый всё равно нужен.
      }
    }

    try {
      const created = await input.gateway.watch(target.credentials, {
        channelId: randomBytes(16).toString("hex"),
        address: input.webhookUrl,
        token: input.webhookToken,
        expiresAt: new Date(input.now.getTime() + WATCH_TTL_MS)
      });
      await input.save(target.userId, created);
      renewed += 1;
    } catch (error) {
      if (error instanceof CalendarAccessRevokedError) {
        await input.markRevoked(target.userId);
        continue;
      }

      if (error instanceof ProviderUnavailableError) {
        throw error;
      }

      throw new ProviderUnavailableError("google-calendar");
    }
  }

  return renewed;
}
