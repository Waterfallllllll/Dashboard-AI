import { createHash, timingSafeEqual } from "node:crypto";

import { API_ERROR_CODES } from "@dashboard/contracts";

import type { JobQueue } from "../../infrastructure/jobs/memory-job-queue.js";
import { ApiError } from "../../shared/errors/api-error.js";

const START_COMMAND = /^\/start(?:@[A-Za-z0-9_]{5,32})?\s+([A-Za-z0-9_-]{20,128})$/;

export type TelegramUpdate = {
  readonly secret: string | undefined;
  readonly text: string | undefined;
  readonly telegramUserId: string | undefined;
};

export type GoogleCalendarNotice = {
  readonly token: string | undefined;
  readonly channelId: string | undefined;
  readonly resourceState: string | undefined;
};

export class WebhookService {
  constructor(
    private readonly telegramSecret: string | null,
    private readonly googleToken: string | null,
    private readonly jobs: JobQueue,
    private readonly linkTelegram: (
      token: string,
      telegramUserId: string
    ) => Promise<"linked" | "invalid">,
    private readonly maxAttempts: number,
    private readonly now: () => Date = () => new Date()
  ) {}

  async acceptTelegram(update: TelegramUpdate): Promise<void> {
    if (!this.telegramSecret) {
      throw new ApiError({ code: API_ERROR_CODES.unavailable });
    }

    if (!secretsMatch(this.telegramSecret, update.secret ?? "")) {
      throw new ApiError({ code: API_ERROR_CODES.unauthenticated });
    }

    const token = update.text ? START_COMMAND.exec(update.text.trim())?.[1] : undefined;

    if (!token || !update.telegramUserId || !/^\d{1,20}$/.test(update.telegramUserId)) {
      return;
    }

    await this.linkTelegram(token, update.telegramUserId);
  }

  async acceptGoogleCalendar(notice: GoogleCalendarNotice): Promise<void> {
    if (!this.googleToken) {
      throw new ApiError({ code: API_ERROR_CODES.unavailable });
    }

    if (!secretsMatch(this.googleToken, notice.token ?? "")) {
      throw new ApiError({ code: API_ERROR_CODES.unauthenticated });
    }

    if (notice.resourceState === "sync" || !notice.channelId || notice.channelId.length > 128) {
      return;
    }

    const channelHash = createHash("sha256").update(notice.channelId).digest("hex").slice(0, 32);
    const bucket = Math.floor(this.now().getTime() / 60_000);
    await this.jobs.schedule({
      type: "sync-calendar",
      payload: { channelId: channelHash },
      runAt: this.now(),
      idempotencyKey: `calendar-webhook:${channelHash}:${bucket}`,
      userId: null,
      maxAttempts: this.maxAttempts
    });
  }
}

export function secretsMatch(expected: string, provided: string): boolean {
  const left = Buffer.from(expected);
  const right = Buffer.from(provided);

  if (left.length === 0 || left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}
