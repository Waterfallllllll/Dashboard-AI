import { describe, expect, it } from "vitest";

import { MemoryJobQueue } from "../../infrastructure/jobs/memory-job-queue.js";
import { WebhookService } from "./webhook.service.js";

const secret = "telegram-secret-value";
const startToken = "a".repeat(32);

describe("ответ бота на /start", () => {
  it("просит новую ссылку без кода и подтверждает удачную привязку", async () => {
    const replies: Array<{ chatId: string; text: string }> = [];
    let links = 0;
    const webhooks = service(async () => {
      links += 1;
      return "linked";
    }, replies);

    await expect(
      webhooks.acceptTelegram({
        secret,
        text: "/start",
        telegramUserId: "42"
      })
    ).resolves.toBe("ignored");
    await expect(
      webhooks.acceptTelegram({
        secret,
        text: `/start ${startToken}`,
        telegramUserId: "42"
      })
    ).resolves.toBe("linked");

    expect(links).toBe(1);
    expect(replies.map((item) => item.chatId)).toEqual(["42", "42"]);
    expect(replies[0]?.text).toContain("без кода");
    expect(replies[1]?.text).toContain("подключён");
    expect(replies.every((item) => item.text.length <= 240)).toBe(true);
  });

  it("сообщает, что ссылка уже недействительна, и не роняет webhook, если ответ не ушёл", async () => {
    const webhooks = service(
      async () => "invalid",
      async () => {
        throw new Error("telegram недоступен");
      }
    );

    await expect(
      webhooks.acceptTelegram({
        secret,
        text: `/start ${startToken}`,
        telegramUserId: "42"
      })
    ).resolves.toBe("invalid");
  });
});

function service(
  link: (token: string, telegramUserId: string) => Promise<"linked" | "invalid">,
  reply: ((chatId: string, text: string) => Promise<void>) | Array<{ chatId: string; text: string }>
): WebhookService {
  const send = Array.isArray(reply)
    ? async (chatId: string, text: string) => {
        reply.push({ chatId, text });
      }
    : reply;

  return new WebhookService(secret, null, new MemoryJobQueue(), link, 5, () => new Date(), send);
}
