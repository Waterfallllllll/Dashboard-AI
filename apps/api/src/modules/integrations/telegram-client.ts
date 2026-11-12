import {
  CircuitBreaker,
  ProviderUnavailableError,
  assertAllowedUrl,
  fetchAllowlisted,
  type FetchLike
} from "../../infrastructure/http/provider-guard.js";

const TOKEN_PATTERN = /^\d{6,16}:[A-Za-z0-9_-]{20,128}$/;
const READY_MS = 15 * 60 * 1000;

export class TelegramClient {
  private checkedAt = 0;
  private readonly breaker = new CircuitBreaker();

  constructor(
    private readonly token: string,
    private readonly username: string,
    private readonly fetchImpl: FetchLike,
    private readonly now: () => number = () => Date.now()
  ) {}

  async assertReady(): Promise<void> {
    if (!TOKEN_PATTERN.test(this.token)) {
      throw new ProviderUnavailableError("telegram");
    }

    if (this.now() - this.checkedAt < READY_MS) {
      return;
    }

    const url = new URL(`https://api.telegram.org/bot${this.token}/getMe`);
    const body = await fetchAllowlisted({
      url,
      allowHosts: ["api.telegram.org"],
      provider: "telegram",
      fetchImpl: this.fetchImpl,
      breaker: this.breaker,
      maxAttempts: 1
    });

    if (!botMatches(parseJson(body), this.username)) {
      throw new ProviderUnavailableError("telegram");
    }

    this.checkedAt = this.now();
  }

  async sendMessage(chatId: string, text: string): Promise<{ messageId: string | null }> {
    if (!/^\d{1,20}$/.test(chatId) || text.length === 0 || text.length > 240) {
      throw new ProviderUnavailableError("telegram", true);
    }

    const url = new URL(`https://api.telegram.org/bot${this.token}/sendMessage`);
    assertAllowedUrl(url, ["api.telegram.org"], "telegram");
    this.breaker.assertClosed("telegram");
    let response: Response;

    try {
      response = await this.fetchImpl(url.toString(), {
        method: "POST",
        redirect: "manual",
        signal: AbortSignal.timeout(3000),
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "user-agent": "EvergreenDashboard/0.1"
        },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          disable_web_page_preview: true
        })
      });
    } catch {
      this.breaker.fail();
      throw new ProviderUnavailableError("telegram");
    }

    if (response.status === 429 || response.status >= 500) {
      await response.body?.cancel();
      this.breaker.fail();
      throw new ProviderUnavailableError("telegram");
    }

    if (!response.ok) {
      await response.body?.cancel();
      throw new ProviderUnavailableError("telegram", true);
    }

    const messageId = messageIdOf(await response.text());
    this.breaker.succeed();
    return { messageId };
  }
}

function botMatches(value: unknown, username: string): boolean {
  if (!isRecord(value) || value.ok !== true || !isRecord(value.result)) {
    return false;
  }

  return (
    value.result.is_bot === true &&
    typeof value.result.username === "string" &&
    value.result.username.toLowerCase() === username.toLowerCase()
  );
}

function parseJson(body: string): unknown {
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function messageIdOf(body: string): string | null {
  const parsed = parseJson(body);

  if (!isRecord(parsed) || parsed.ok !== true || !isRecord(parsed.result)) {
    return null;
  }

  return typeof parsed.result.message_id === "number" ? String(parsed.result.message_id) : null;
}
