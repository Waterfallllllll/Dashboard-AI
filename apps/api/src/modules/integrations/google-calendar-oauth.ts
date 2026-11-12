import * as client from "openid-client";

import { GOOGLE_AUTHORIZATION_HOST, GOOGLE_CALENDAR_SCOPE } from "../../config/constants.js";
import { googleCallbackUrl } from "../auth/oauth-request.js";

export type CalendarAuthorization = {
  readonly url: string;
  readonly state: string;
  readonly codeVerifier: string;
};

export type CalendarTokenSet = {
  readonly accessToken: string;
  readonly refreshToken: string | null;
  readonly expiresIn: number | null;
  readonly scope: string | null;
};

export type CalendarOAuthClient = {
  createAuthorizationRequest(): Promise<CalendarAuthorization>;
  exchangeAuthorizationCode(
    query: URLSearchParams,
    checks: { readonly state: string; readonly codeVerifier: string }
  ): Promise<CalendarTokenSet>;
};

export function createCalendarOAuthClient(options: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): CalendarOAuthClient {
  let configuration: Promise<client.Configuration> | undefined;
  const load = (): Promise<client.Configuration> => {
    configuration ??= client
      .discovery(
        new URL(`https://${GOOGLE_AUTHORIZATION_HOST}`),
        options.clientId,
        options.clientSecret,
        undefined,
        {
          timeout: 10
        }
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
      const url = client.buildAuthorizationUrl(config, {
        redirect_uri: options.redirectUri,
        scope: GOOGLE_CALENDAR_SCOPE,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        state,
        access_type: "offline",
        prompt: "consent"
      });

      return { url: url.href, state, codeVerifier };
    },
    async exchangeAuthorizationCode(query, checks) {
      const config = await load();
      const tokens = await client.authorizationCodeGrant(
        config,
        googleCallbackUrl(options.redirectUri, query),
        {
          pkceCodeVerifier: checks.codeVerifier,
          expectedState: checks.state,
          idTokenExpected: false
        }
      );

      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        expiresIn: tokens.expires_in ?? null,
        scope: tokens.scope ?? null
      };
    }
  };
}
