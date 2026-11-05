import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

type PushContract = {
  parsePushMessage: (value: unknown) => {
    title: string;
    body: string;
    path: string;
    tag: string;
  };
  safeNotificationPath: (value: unknown) => string;
};

const contractUrl = new URL("../../../../public/push-contract.js", import.meta.url).href;

describe("push payload", () => {
  it("оставляет только безопасный путь и текст уведомления", async () => {
    const contract = (await import(contractUrl)) as PushContract;
    const message = contract.parsePushMessage({
      title: " Таймер\nготов ",
      body: "Интервал завершён",
      path: "/dashboard?tab=timer",
      tag: "timer:1"
    });

    expect(message).toEqual({
      title: "Таймер готов",
      body: "Интервал завершён",
      path: "/dashboard?tab=timer",
      tag: "timer:1"
    });
    expect(contract.safeNotificationPath("https://evil.example/phish")).toBe("/dashboard");
    expect(contract.safeNotificationPath("//evil.example")).toBe("/dashboard");
    expect(contract.parsePushMessage(null).title).toBe("Evergreen");
  });

  it("service worker показывает push и не исполняет содержимое", () => {
    const source = readFileSync(new URL("../../../../public/sw.js", import.meta.url), "utf8");

    expect(source).toContain('from "./push-contract.js"');
    expect(source).toContain("showNotification");
    expect(source).toContain("openWindow");
    expect(source).not.toMatch(/eval\(|innerHTML|document\.write|importScripts\(/);
  });
});
