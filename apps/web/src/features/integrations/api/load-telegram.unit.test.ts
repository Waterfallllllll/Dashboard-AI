import { describe, expect, it, vi } from "vitest";

import { loadTelegramStatus } from "./load-integrations";

const body = {
  data: {
    integrations: [
      {
        type: "google_calendar",
        status: "connected",
        lastSyncAt: "2026-11-25T12:32:32.044Z"
      },
      { type: "telegram", status: "disconnected", lastSyncAt: null }
    ]
  },
  meta: { requestId: "request-1" }
};

describe("статус Telegram", () => {
  it("читает telegram из списка интеграций и не путает его с календарём", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
    );

    await expect(loadTelegramStatus("http://localhost:4000", "session=abc", fetchImpl)).resolves.toBe(
      "disconnected"
    );
  });
});
