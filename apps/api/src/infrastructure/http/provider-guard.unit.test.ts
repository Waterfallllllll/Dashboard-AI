import { describe, expect, it } from "vitest";

import { CircuitBreaker, ProviderUnavailableError, fetchAllowlisted } from "./provider-guard.js";

const host = "api.open-meteo.com";
const url = new URL("https://api.open-meteo.com/v1/forecast?latitude=55.76&longitude=37.62");

describe("защита внешних запросов", () => {
  it("не ходит на чужой адрес и не кладёт адрес в текст ошибки", async () => {
    const breaker = new CircuitBreaker();

    await expect(
      fetchAllowlisted({
        url: new URL("http://127.0.0.1/latest/meta-data"),
        allowHosts: [host],
        provider: "weather",
        fetchImpl: async () => {
          throw new Error("не должен вызваться");
        },
        breaker
      })
    ).rejects.toMatchObject({ name: "ProviderUnavailableError" });
    await expect(
      fetchAllowlisted({
        url: new URL("https://evil.example/v1/forecast"),
        allowHosts: [host],
        provider: "weather",
        fetchImpl: async () => {
          throw new Error("не должен вызваться");
        },
        breaker
      })
    ).rejects.toThrow(ProviderUnavailableError);
  });

  it("повторяет временный отказ и открывает контур после серии сбоев", async () => {
    const calls: string[] = [];
    const breaker = new CircuitBreaker(2, 60_000, () => 1_000);
    const fetchImpl = async (input: string) => {
      calls.push(input);
      return new Response("busy", { status: calls.length === 1 ? 503 : 200 });
    };

    await expect(
      fetchAllowlisted({
        url,
        allowHosts: [host],
        provider: "weather",
        fetchImpl,
        breaker,
        sleep: async () => undefined
      })
    ).resolves.toBe("busy");
    expect(calls).toHaveLength(2);
    expect(calls[0]).not.toContain("secret");

    const failing = new CircuitBreaker(1, 60_000, () => 1_000);
    await expect(
      fetchAllowlisted({
        url,
        allowHosts: [host],
        provider: "weather",
        fetchImpl: async (input) => {
          throw new Error(`network ${input} token-should-stay-hidden`);
        },
        breaker: failing,
        sleep: async () => undefined,
        maxAttempts: 1
      })
    ).rejects.toThrow("Внешний сервис временно недоступен");
    await expect(
      fetchAllowlisted({
        url,
        allowHosts: [host],
        provider: "weather",
        fetchImpl: async () => new Response("ok", { status: 200 }),
        breaker: failing
      })
    ).rejects.toThrow(ProviderUnavailableError);
  });

  it("не следует редиректу", async () => {
    const breaker = new CircuitBreaker();

    await expect(
      fetchAllowlisted({
        url,
        allowHosts: [host],
        provider: "weather",
        fetchImpl: async () => new Response(null, { status: 302, headers: { location: "https://evil.example" } }),
        breaker,
        maxAttempts: 1
      })
    ).rejects.toThrow(ProviderUnavailableError);
  });
});
