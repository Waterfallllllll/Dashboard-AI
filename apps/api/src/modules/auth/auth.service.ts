import { randomBytes } from "node:crypto";

import {
  CREDENTIAL_PURPOSES,
  type CredentialCipher
} from "../../infrastructure/crypto/credential-cipher.js";
import { DEFAULT_LOCALE } from "../../config/constants.js";
import type { UserProfile } from "../users/user-profile.js";
import {
  GoogleAccountBlockedError,
  OAuthCallbackError,
  type RequestSession
} from "./auth.types.js";
import type { AuthRepository } from "./auth.repository.js";
import { readGoogleIdentity } from "./google-identity.js";
import { assertGoogleAuthorizationUrl } from "./oauth-request.js";
import type { GoogleOAuthClient } from "./google-oauth.js";
import { hashToken } from "./token-hash.js";
import { z } from "zod";

const STATE_PATTERN = /^[A-Za-z0-9_-]{16,256}$/;
const VERIFIER_PATTERN = /^[A-Za-z0-9_-]{43,128}$/;

const oauthPayloadSchema = z.strictObject({
  codeVerifier: z.string().regex(VERIFIER_PATTERN),
  nonce: z.string().regex(STATE_PATTERN)
});

export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly google: GoogleOAuthClient,
    private readonly cipher: CredentialCipher,
    private readonly sessionTtlMs: number,
    private readonly oauthStateTtlMs: number,
    private readonly now: () => Date = () => new Date()
  ) {}

  async beginLogin(): Promise<string> {
    const request = await this.google.createAuthorizationRequest();
    assertGoogleAuthorizationUrl(request.url);

    if (
      !STATE_PATTERN.test(request.state) ||
      !STATE_PATTERN.test(request.nonce) ||
      !VERIFIER_PATTERN.test(request.codeVerifier)
    ) {
      throw new OAuthCallbackError("error");
    }

    const now = this.now();
    await this.repository.saveOauthState({
      tokenHash: hashToken(request.state),
      encryptedPayload: this.cipher.encrypt(
        JSON.stringify({ codeVerifier: request.codeVerifier, nonce: request.nonce }),
        CREDENTIAL_PURPOSES.oauthTransaction
      ),
      expiresAt: new Date(now.getTime() + this.oauthStateTtlMs),
      now
    });
    return request.url;
  }

  async completeLogin(query: URLSearchParams): Promise<{
    token: string;
    user: UserProfile;
    expiresAt: Date;
  }> {
    const providerError = query.get("error");

    if (providerError === "access_denied") {
      await this.consumeIfPresent(query.get("state"));
      throw new OAuthCallbackError("cancelled");
    }

    if (providerError) {
      await this.consumeIfPresent(query.get("state"));
      throw new OAuthCallbackError("error");
    }

    const state = query.get("state");
    const code = query.get("code");

    if (!code || !state || !STATE_PATTERN.test(state)) {
      throw new OAuthCallbackError("error");
    }

    const now = this.now();
    const consumed = await this.repository.consumeOauthState(hashToken(state), now);

    if (!consumed) {
      throw new OAuthCallbackError("error");
    }

    const payload = this.readPayload(consumed.encryptedPayload);
    let tokenSet;

    try {
      tokenSet = await this.google.exchangeAuthorizationCode(query, {
        state,
        nonce: payload.nonce,
        codeVerifier: payload.codeVerifier
      });
    } catch {
      throw new OAuthCallbackError("error");
    }

    const identity = readGoogleIdentity({ ...tokenSet, now });

    if (!identity) {
      throw new OAuthCallbackError("error");
    }

    const token = randomBytes(32).toString("base64url");

    try {
      const login = await this.repository.completeGoogleLogin({
        providerUserId: identity.subject,
        encryptedAccessToken: this.cipher.encrypt(
          identity.accessToken,
          CREDENTIAL_PURPOSES.accessToken
        ),
        encryptedRefreshToken: identity.refreshToken
          ? this.cipher.encrypt(identity.refreshToken, CREDENTIAL_PURPOSES.refreshToken)
          : null,
        scope: identity.scopes,
        tokenExpiresAt: identity.expiresAt,
        displayName: identity.displayName,
        avatarUrl: identity.avatarUrl,
        locale: identity.locale ?? DEFAULT_LOCALE,
        tokenHash: hashToken(token),
        sessionExpiresAt: new Date(now.getTime() + this.sessionTtlMs),
        now
      });

      return { token, user: login.user, expiresAt: login.expiresAt };
    } catch (error) {
      if (error instanceof GoogleAccountBlockedError) {
        throw new OAuthCallbackError("error");
      }

      throw error;
    }
  }

  async authenticate(token: string): Promise<RequestSession | null> {
    if (!/^[A-Za-z0-9_-]{43,128}$/.test(token)) {
      return null;
    }

    const active = await this.repository.findActiveSession(hashToken(token), this.now());

    if (!active) {
      return null;
    }

    return {
      actor: { userId: active.user.id, sessionId: active.sessionId },
      user: active.user,
      expiresAt: active.expiresAt,
      sessionToken: token
    };
  }

  async revoke(sessionId: string): Promise<void> {
    await this.repository.revokeSession(sessionId, this.now());
  }

  private async consumeIfPresent(state: string | null): Promise<void> {
    if (!state || !STATE_PATTERN.test(state)) {
      return;
    }

    await this.repository.consumeOauthState(hashToken(state), this.now());
  }

  private readPayload(encrypted: string): { codeVerifier: string; nonce: string } {
    let plaintext: string;

    try {
      plaintext = this.cipher.decrypt(encrypted, CREDENTIAL_PURPOSES.oauthTransaction);
    } catch {
      throw new OAuthCallbackError("error");
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(plaintext);
    } catch {
      throw new OAuthCallbackError("error");
    }

    const result = oauthPayloadSchema.safeParse(parsed);

    if (!result.success) {
      throw new OAuthCallbackError("error");
    }

    return result.data;
  }
}
