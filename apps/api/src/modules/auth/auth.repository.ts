import type { UserProfile } from "../users/user-profile.js";

export type OauthStateRecord = {
  readonly tokenHash: string;
  readonly encryptedPayload: string;
  readonly expiresAt: Date;
  readonly now: Date;
};

export type NewGoogleLogin = {
  readonly providerUserId: string;
  readonly encryptedAccessToken: string;
  readonly encryptedRefreshToken: string | null;
  readonly scope: readonly string[];
  readonly tokenExpiresAt: Date | null;
  readonly displayName: string;
  readonly avatarUrl: string | null;
  readonly locale: string;
  readonly tokenHash: string;
  readonly sessionExpiresAt: Date;
  readonly now: Date;
};

export type ActiveSession = {
  readonly sessionId: string;
  readonly user: UserProfile;
  readonly expiresAt: Date;
};

export type AuthRepository = {
  saveOauthState(input: OauthStateRecord): Promise<void>;
  consumeOauthState(tokenHash: string, now: Date): Promise<{ encryptedPayload: string } | null>;
  completeGoogleLogin(input: NewGoogleLogin): Promise<ActiveSession>;
  findActiveSession(tokenHash: string, now: Date): Promise<ActiveSession | null>;
  revokeSession(sessionId: string, now: Date): Promise<void>;
};
