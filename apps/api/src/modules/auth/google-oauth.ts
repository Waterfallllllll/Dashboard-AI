import * as client from "openid-client";

import { GOOGLE_AUTHORIZATION_HOST, GOOGLE_SCOPES } from "../../config/constants.js";
import type { GoogleTokenSet } from "./google-identity.js";
import { googleCallbackUrl } from "./oauth-request.js";

export type GoogleAuthorizationRequest = {
  readonly url: string;
  readonly state: string;
  readonly nonce: string;
  readonly codeVerifier: string;
};

export type GoogleAuthorizationChecks = {
  readonly state: string;
  readonly nonce: string;
  readonly codeVerifier: string;
};

export type GoogleOAuthClient = {
  createAuthorizationRequest(): Promise<GoogleAuthorizationRequest>;
  exchangeAuthorizationCode(
    query: URLSearchParams,
    checks: GoogleAuthorizationChecks
  ): Promise<GoogleTokenSet>;
};

export function createGoogleOAuthClient(options: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): GoogleOAuthClient {
  let configuration: Promise<client.Configuration> | undefined;
  const load = (): Promise<client.Configuration> => {
    configuration ??= client
      .discovery(
        new URL(`https://${GOOGLE_AUTHORIZATION_HOST}`),
        options.clientId,
        options.clientSecret,
        undefined,
        { timeout: 10 }
      )
      .catch((error: unknown) => {
        configuration = undefined;
        throw error;
      });
    return configuration;
  };

  return {
    async createAuthorizationRequest() {
      const config = await load();
      const codeVerifier = client.randomPKCECodeVerifier();
      const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
      const state = client.randomState();
      const nonce = client.randomNonce();
      const url = client.buildAuthorizationUrl(config, {
        redirect_uri: options.redirectUri,
        scope: GOOGLE_SCOPES,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        state,
        nonce,
        access_type: "offline",
        prompt: "consent"
      });

      return { url: url.href, state, nonce, codeVerifier };
    },
    async exchangeAuthorizationCode(query, checks) {
      const config = await load();
      const tokens = await client.authorizationCodeGrant(
        config,
        googleCallbackUrl(options.redirectUri, query),
        {
          pkceCodeVerifier: checks.codeVerifier,
          expectedState: checks.state,
          expectedNonce: checks.nonce,
          idTokenExpected: true
        }
      );
      const claims = tokens.claims();

      if (!claims) {
        throw new Error("Нет ID Token");
      }

      return {
        subject: claims.sub,
        emailVerified: claims.email_verified,
        name: claims.name,
        picture: claims.picture,
        locale: claims.locale,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresIn: tokens.expires_in,
        scope: tokens.scope
      };
    }
  };
}
