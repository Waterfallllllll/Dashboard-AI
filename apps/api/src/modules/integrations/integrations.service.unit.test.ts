import { describe, expect, it } from "vitest";

import { GOOGLE_CALENDAR_SCOPE } from "../../config/constants.js";
import {
  CREDENTIAL_PURPOSES,
  createCredentialCipher,
  readDataEncryptionKey
} from "../../infrastructure/crypto/credential-cipher.js";
import type { FetchLike } from "../../infrastructure/http/provider-guard.js";
import { hashToken } from "../auth/token-hash.js";
import type { CalendarOAuthClient } from "./google-calendar-oauth.js";
import { IntegrationsService } from "./integrations.service.js";
import { MemoryIntegrationsRepository, type TokenWrite } from "./integrations.repository.js";
import { TelegramClient } from "./telegram-client.js";

const actor = { userId: "a".repeat(24), sessionId: "session" };
const accessToken = "ya29.secret-access";
const botToken = "123456789:AAAAAAAAAAAAAAAAAAAA";

describe("подключение календаря и Telegram", () => {
  it("хранит hash ссылки и шифрует токен доступа", async () => {
    const cipher = createCredentialCipher(
      readDataEncryptionKey({ DATA_ENCRYPTION_KEY: Buffer.alloc(32, 4).toString("base64url") })
    );
    const repository = new RecordingIntegrations();
    const oauth: CalendarOAuthClient = {
      async createAuthorizationRequest() {
        return {
          url: "https://accounts.google.com/o/oauth2/v2/auth?state=calendar-state",
          state: "calendar-state",
          codeVerifier: "calendar-verifier-secret"
        };
      },
      async exchangeAuthorizationCode() {
        return {
          accessToken,
          refreshToken: "refresh-secret",
          expiresIn: 3600,
          scope: GOOGLE_CALENDAR_SCOPE
        };
      }
    };
    const fetchImpl: FetchLike = async () =>
      Response.json({ ok: true, result: { is_bot: true, username: "DashBot" } });
    const service = new IntegrationsService(
      repository,
      cipher,
      oauth,
      new TelegramClient(botToken, "DashBot", fetchImpl),
      "DashBot"
    );

    const connect = await service.beginGoogle(actor);
    expect(connect.url).not.toContain("calendar-verifier-secret");
    expect(repository.savedTokens[0]?.tokenHash).toBe(hashToken("calendar-state"));
    expect(repository.savedTokens[0]?.tokenHash).not.toBe("calendar-state");
    expect(repository.savedTokens[0]?.encryptedPayload).not.toContain("calendar-verifier-secret");

    await service.completeGoogle(
      actor,
      new URLSearchParams({ code: "auth-code", state: "calendar-state" })
    );
    const calendar = await repository.find(actor.userId, "google_calendar");
    expect(calendar?.encryptedCredentials?.startsWith("enc:v1:")).toBe(true);
    expect(calendar?.encryptedCredentials).not.toContain(accessToken);
    expect(
      cipher.decrypt(
        calendar?.encryptedCredentials ?? "",
        CREDENTIAL_PURPOSES.integrationCredentials
      )
    ).toContain(accessToken);

    const link = await service.beginTelegram(actor);
    const token = new URL(link.url).searchParams.get("start") ?? "";
    expect(link.url.startsWith("https://t.me/DashBot?start=")).toBe(true);
    expect(repository.savedTokens.at(-1)?.tokenHash).toBe(hashToken(token));
    expect(repository.savedTokens.at(-1)?.encryptedPayload).not.toContain(token);
    expect(await service.completeTelegramLink(token, "4242")).toBe("linked");
    expect(await service.completeTelegramLink(token, "4242")).toBe("invalid");
    const telegram = await repository.find(actor.userId, "telegram");
    expect(telegram?.externalUserId).toBe("4242");
    expect(JSON.stringify(await service.list(actor))).not.toContain(token);
    expect(JSON.stringify(await service.list(actor))).not.toContain(accessToken);
  });
});

class RecordingIntegrations extends MemoryIntegrationsRepository {
  readonly savedTokens: TokenWrite[] = [];

  override async saveToken(input: TokenWrite): Promise<void> {
    this.savedTokens.push(input);
    await super.saveToken(input);
  }
}
