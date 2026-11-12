import { describe, expect, it } from "vitest";

import { readApiEnv } from "./env.js";

const encryptionKey = Buffer.alloc(32, 6).toString("base64url");
const sessionSecret = "session-secret-value-0123456789abcd";
const googleSecret = "google-client-secret-value";

const validEnv = {
  NODE_ENV: "development",
  APP_ORIGIN: "http://localhost:3000",
  PORT: "4000",
  TRUST_PROXY_HOPS: "1",
  SESSION_SECRET: sessionSecret,
  DATA_ENCRYPTION_KEY: encryptionKey,
  GOOGLE_CLIENT_ID: "google-client",
  GOOGLE_CLIENT_SECRET: googleSecret,
  GOOGLE_REDIRECT_URI: "http://localhost:3000/api/v1/auth/google/callback"
};

describe("окружение API", () => {
  it("собирает публичную конфигурацию без секретов Google и ключа шифрования", () => {
    const runtime = readApiEnv(validEnv);

    expect(runtime.config.appOrigin).toBe("http://localhost:3000");
    expect(runtime.config.trustProxyHops).toBe(1);
    expect(runtime.config.googleRedirectUri).toBe(validEnv.GOOGLE_REDIRECT_URI);
    expect(runtime.config.googleCalendarRedirectUri).toBe(
      "http://localhost:3000/api/v1/integrations/google/callback"
    );
    expect(runtime.weatherApiBaseUrl).toBe("https://api.open-meteo.com");
    expect(runtime.telegram).toBeNull();
    expect(runtime.googleClientSecret).toBe(googleSecret);
    expect(JSON.stringify(runtime.config)).not.toContain(googleSecret);
    expect(JSON.stringify(runtime.config)).not.toContain(encryptionKey);
  });

  it("не принимает короткий секрет, чужой callback и http вне localhost", () => {
    const leaked = "short-secret-value";

    expect(() => readApiEnv({ ...validEnv, SESSION_SECRET: leaked })).toThrow(/SESSION_SECRET/);
    expect(() => readApiEnv({ ...validEnv, SESSION_SECRET: leaked })).not.toThrow(
      /short-secret-value/
    );
    expect(() =>
      readApiEnv({
        ...validEnv,
        GOOGLE_REDIRECT_URI:
          "http://localhost:3000/api/v1/auth/google/callback?next=https://evil.test"
      })
    ).toThrow(/GOOGLE_REDIRECT_URI/);
    expect(() =>
      readApiEnv({
        ...validEnv,
        NODE_ENV: "production",
        APP_ORIGIN: "http://localhost:3000",
        GOOGLE_REDIRECT_URI: "http://localhost:3000/api/v1/auth/google/callback"
      })
    ).toThrow(/https/);
    const telegramToken = "123456789:AAAAAAAAAAAAAAAAAAAA";
    expect(() => readApiEnv({ ...validEnv, TELEGRAM_BOT_TOKEN: telegramToken })).toThrow(
      /TELEGRAM/
    );
    expect(() => readApiEnv({ ...validEnv, TELEGRAM_BOT_TOKEN: telegramToken })).not.toThrow(
      /AAAAAAAAAAAAAAAAAAAA/
    );
    expect(() => readApiEnv({ ...validEnv, WEATHER_API_BASE_URL: "https://evil.test" })).toThrow(
      /WEATHER_API_BASE_URL/
    );
  });
});
