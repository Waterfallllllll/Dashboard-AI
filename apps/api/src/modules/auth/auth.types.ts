import type { UserProfile } from "../users/user-profile.js";

export type Actor = {
  readonly userId: string;
  readonly sessionId: string;
};

export type RequestSession = {
  readonly actor: Actor;
  readonly user: UserProfile;
  readonly expiresAt: Date;
  readonly sessionToken: string;
};

export class OAuthCallbackError extends Error {
  readonly status: "cancelled" | "error";

  constructor(status: "cancelled" | "error") {
    super(status === "cancelled" ? "Вход отменён" : "Не удалось завершить вход");
    this.name = "OAuthCallbackError";
    this.status = status;
  }
}

export class GoogleAccountBlockedError extends Error {
  constructor() {
    super("Вход для этого аккаунта недоступен");
    this.name = "GoogleAccountBlockedError";
  }
}
