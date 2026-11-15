import { randomBytes } from "node:crypto";

import { API_ERROR_CODES, entityIdSchema } from "@dashboard/contracts";
import type { IntegrationList } from "@dashboard/contracts";
import { z } from "zod";

import { GOOGLE_CALENDAR_SCOPE, OAUTH_STATE_TTL_MS } from "../../config/constants.js";
import {
  CREDENTIAL_PURPOSES,
  type CredentialCipher
} from "../../infrastructure/crypto/credential-cipher.js";
import { ProviderUnavailableError } from "../../infrastructure/http/provider-guard.js";
import { ApiError } from "../../shared/errors/api-error.js";
import type { Actor } from "../auth/auth.types.js";
import { assertGoogleAuthorizationUrl } from "../auth/oauth-request.js";
import { hashToken } from "../auth/token-hash.js";
import { noopAudit, type AuditRecorder } from "../audit/audit.service.js";
import type { CalendarOAuthClient } from "./google-calendar-oauth.js";
import type { IntegrationKind, IntegrationsRepository } from "./integrations.repository.js";
import type { TelegramClient } from "./telegram-client.js";

const calendarPayloadSchema = z.strictObject({
  userId: entityIdSchema,
  codeVerifier: z.string().min(16).max(256)
});

const telegramPayloadSchema = z.strictObject({
  userId: entityIdSchema
});

const credentialSchema = z.strictObject({
  accessToken: z.string().min(1).max(4096),
  refreshToken: z.string().min(1).max(4096).nullable(),
  expiresAt: z.string().nullable()
});

export class IntegrationsService {
  constructor(
    private readonly integrations: IntegrationsRepository,
    private readonly cipher: CredentialCipher,
    private readonly oauth: CalendarOAuthClient,
    private readonly telegram: TelegramClient | null,
    private readonly telegramUsername: string | null,
    private readonly now: () => Date = () => new Date(),
    private readonly ttlMs = OAUTH_STATE_TTL_MS,
    private readonly audit: AuditRecorder = noopAudit
  ) {}

  async list(actor: Actor): Promise<IntegrationList> {
    const records = await this.integrations.list(actor.userId);
    return {
      integrations: (["google_calendar", "telegram"] as const).map((type) => {
        const found = records.find((item) => item.type === type && item.userId === actor.userId);

        if (!found) {
          return { type, status: "disconnected" as const, lastSyncAt: null };
        }

        return {
          type,
          status: found.status,
          lastSyncAt: found.lastSyncAt ? found.lastSyncAt.toISOString() : null
        };
      })
    };
  }

  async beginGoogle(actor: Actor): Promise<{ url: string }> {
    let request: Awaited<ReturnType<CalendarOAuthClient["createAuthorizationRequest"]>>;

    try {
      request = await this.oauth.createAuthorizationRequest();
      assertGoogleAuthorizationUrl(request.url);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError({ code: API_ERROR_CODES.unavailable });
    }

    await this.integrations.saveToken({
      purpose: "calendar_oauth",
      tokenHash: hashToken(request.state),
      encryptedPayload: this.cipher.encrypt(
        JSON.stringify({ userId: actor.userId, codeVerifier: request.codeVerifier }),
        CREDENTIAL_PURPOSES.oauthTransaction
      ),
      expiresAt: new Date(this.now().getTime() + this.ttlMs),
      now: this.now()
    });

    return { url: request.url };
  }

  async completeGoogle(actor: Actor, query: URLSearchParams): Promise<"connected" | "cancelled"> {
    if (query.get("error") === "access_denied") {
      const state = query.get("state");

      if (state) {
        await this.integrations.consumeToken("calendar_oauth", hashToken(state), this.now());
      }

      return "cancelled";
    }

    const state = query.get("state");
    const code = query.get("code");

    if (!state || !code) {
      throw new ApiError({ code: API_ERROR_CODES.unavailable });
    }

    const consumed = await this.integrations.consumeToken(
      "calendar_oauth",
      hashToken(state),
      this.now()
    );
    const payload = consumed ? this.readCalendarPayload(consumed.encryptedPayload) : null;

    if (!payload || payload.userId !== actor.userId) {
      throw new ApiError({ code: API_ERROR_CODES.unavailable });
    }

    let tokens: Awaited<ReturnType<CalendarOAuthClient["exchangeAuthorizationCode"]>>;

    try {
      tokens = await this.oauth.exchangeAuthorizationCode(query, {
        state,
        codeVerifier: payload.codeVerifier
      });
    } catch {
      throw new ApiError({ code: API_ERROR_CODES.unavailable });
    }

    const scopes = (tokens.scope ?? "").split(" ").filter((scope) => scope.length > 0);

    if (!tokens.accessToken || !scopes.includes(GOOGLE_CALENDAR_SCOPE)) {
      throw new ApiError({ code: API_ERROR_CODES.unavailable });
    }

    const saved = await this.integrations.upsert({
      userId: actor.userId,
      type: "google_calendar",
      encryptedCredentials: this.cipher.encrypt(
        JSON.stringify({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt:
            tokens.expiresIn === null
              ? null
              : new Date(this.now().getTime() + tokens.expiresIn * 1000).toISOString()
        }),
        CREDENTIAL_PURPOSES.integrationCredentials
      ),
      scope: scopes.slice(0, 30),
      externalUserId: null,
      now: this.now()
    });

    if (!saved || saved.userId !== actor.userId) {
      throw new ApiError({ code: API_ERROR_CODES.unavailable });
    }

    await this.audit.record({
      userId: actor.userId,
      action: "integration_connected",
      target: "google_calendar"
    });

    return "connected";
  }

  async beginTelegram(actor: Actor): Promise<{ url: string; expiresAt: string }> {
    if (!this.telegram || !this.telegramUsername) {
      throw new ApiError({ code: API_ERROR_CODES.unavailable });
    }

    try {
      await this.telegram.assertReady();
    } catch (error) {
      if (error instanceof ProviderUnavailableError) {
        throw new ApiError({ code: API_ERROR_CODES.unavailable });
      }

      throw new ApiError({ code: API_ERROR_CODES.unavailable });
    }

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(this.now().getTime() + this.ttlMs);
    await this.integrations.saveToken({
      purpose: "telegram_link",
      tokenHash: hashToken(token),
      encryptedPayload: this.cipher.encrypt(
        JSON.stringify({ userId: actor.userId }),
        CREDENTIAL_PURPOSES.oauthTransaction
      ),
      expiresAt,
      now: this.now()
    });

    return {
      url: `https://t.me/${this.telegramUsername}?start=${token}`,
      expiresAt: expiresAt.toISOString()
    };
  }

  async completeTelegramLink(token: string, telegramUserId: string): Promise<"linked" | "invalid"> {
    if (!/^\d{1,20}$/.test(telegramUserId) || token.length < 20 || token.length > 128) {
      return "invalid";
    }

    const consumed = await this.integrations.consumeToken(
      "telegram_link",
      hashToken(token),
      this.now()
    );
    const payload = consumed ? this.readTelegramPayload(consumed.encryptedPayload) : null;

    if (!payload) {
      return "invalid";
    }

    const saved = await this.integrations.upsert({
      userId: payload.userId,
      type: "telegram",
      encryptedCredentials: null,
      scope: [],
      externalUserId: telegramUserId,
      now: this.now()
    });

    if (!saved) {
      return "invalid";
    }

    await this.audit.record({
      userId: payload.userId,
      action: "integration_connected",
      target: "telegram"
    });

    return "linked";
  }

  async telegramChatId(userId: string): Promise<string | null> {
    const record = await this.integrations.find(userId, "telegram");

    if (!record || record.userId !== userId || record.status !== "connected") {
      return null;
    }

    return record.externalUserId;
  }

  async connectedCalendarUserIds(limit: number): Promise<readonly string[]> {
    return this.integrations.listConnectedUserIds("google_calendar", limit);
  }

  async disconnect(actor: Actor, type: IntegrationKind): Promise<void> {
    await this.integrations.softDelete(actor.userId, type, this.now());
    await this.audit.record({
      userId: actor.userId,
      action: "integration_disconnected",
      target: type
    });
  }

  async calendarState(userId: string): Promise<{
    integrationId: string;
    status: "connected" | "revoked";
    lastSyncAt: Date | null;
    syncCursor: string | null;
    accessToken: string | null;
    refreshToken: string | null;
    expiresAt: Date | null;
  } | null> {
    const record = await this.integrations.find(userId, "google_calendar");

    if (!record || record.userId !== userId) {
      return null;
    }

    if (record.status !== "connected" || !record.encryptedCredentials) {
      return {
        integrationId: record.id,
        status: "revoked",
        lastSyncAt: record.lastSyncAt,
        syncCursor: null,
        accessToken: null,
        refreshToken: null,
        expiresAt: null
      };
    }

    const credentials = this.readCredentials(record.encryptedCredentials);

    if (!credentials) {
      await this.integrations.markRevoked(userId, this.now());
      return {
        integrationId: record.id,
        status: "revoked",
        lastSyncAt: record.lastSyncAt,
        syncCursor: null,
        accessToken: null,
        refreshToken: null,
        expiresAt: null
      };
    }

    return {
      integrationId: record.id,
      status: "connected",
      lastSyncAt: record.lastSyncAt,
      syncCursor: record.syncCursor,
      accessToken: credentials.accessToken,
      refreshToken: credentials.refreshToken,
      expiresAt: credentials.expiresAt ? new Date(credentials.expiresAt) : null
    };
  }

  async saveCalendarSync(
    userId: string,
    cursor: string | null,
    accessToken: string | null,
    now: Date
  ): Promise<void> {
    const current = accessToken ? await this.calendarState(userId) : null;
    const encrypted =
      current && accessToken && current.accessToken
        ? this.cipher.encrypt(
            JSON.stringify({
              accessToken,
              refreshToken: current.refreshToken,
              expiresAt: current.expiresAt ? current.expiresAt.toISOString() : null
            }),
            CREDENTIAL_PURPOSES.integrationCredentials
          )
        : null;
    await this.integrations.saveSync(userId, cursor, encrypted, now);
  }

  async markCalendarRevoked(userId: string, now: Date): Promise<void> {
    await this.integrations.markRevoked(userId, now);
  }

  private readCalendarPayload(payload: string): z.infer<typeof calendarPayloadSchema> | null {
    return this.readPayload(payload, calendarPayloadSchema);
  }

  private readTelegramPayload(payload: string): z.infer<typeof telegramPayloadSchema> | null {
    return this.readPayload(payload, telegramPayloadSchema);
  }

  private readPayload<Schema extends z.ZodType>(
    payload: string,
    schema: Schema
  ): z.infer<Schema> | null {
    try {
      const parsed = schema.safeParse(
        JSON.parse(this.cipher.decrypt(payload, CREDENTIAL_PURPOSES.oauthTransaction))
      );
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  private readCredentials(payload: string): z.infer<typeof credentialSchema> | null {
    try {
      const parsed = credentialSchema.safeParse(
        JSON.parse(this.cipher.decrypt(payload, CREDENTIAL_PURPOSES.integrationCredentials))
      );
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }
}
