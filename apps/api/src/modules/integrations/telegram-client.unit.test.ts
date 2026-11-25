import { describe, expect, it, vi } from "vitest";

import { ProviderUnavailableError } from "../../infrastructure/http/provider-guard.js";
import { TelegramClient } from "./telegram-client.js";

const token = "123456789:AAAAAAAAAAAAAAAAAAAA";
const secret = "b".repeat(32);
const webhookUrl = "https://hook.example/api/v1/webhooks/telegram";

describe("регистрация webhook Telegram", () => {
  it("передаёт адрес и секрет в setWebhook", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => json({ ok: true, result: true }));
    const client = new TelegramClient(token, "DashBot", fetchImpl);

    await client.setWebhook(webhookUrl, secret);

    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    const body = JSON.parse(String(init?.body)) as {
      url: string;
      secret_token: string;
      allowed_updates: string[];
    };

    expect(String(url)).toBe(`https://api.telegram.org/bot${token}/setWebhook`);
    expect(init?.method).toBe("POST");
    expect(body.url).toBe(webhookUrl);
    expect(body.secret_token).toBe(secret);
    expect(body.allowed_updates).toEqual(["message"]);
  });

  it("отклоняет адрес не на путь webhook", async () => {
    const client = new TelegramClient(token, "DashBot", vi.fn<typeof fetch>());

    await expect(
      client.setWebhook("https://hook.example/other", secret)
    ).rejects.toBeInstanceOf(ProviderUnavailableError);
    await expect(client.setWebhook("http://hook.example/api/v1/webhooks/telegram", secret)).rejects.toBeInstanceOf(
      ProviderUnavailableError
    );
  });
});

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}
