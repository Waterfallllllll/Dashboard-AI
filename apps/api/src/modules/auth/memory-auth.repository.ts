import { randomBytes } from "node:crypto";

import { NEW_USER_DEFAULTS, type UserProfile } from "../users/user-profile.js";
import type { ProfileUpdate } from "../users/user-profile.js";
import type { StoredWeatherLocation, UsersRepository } from "../users/users.repository.js";
import { GoogleAccountBlockedError } from "./auth.types.js";
import type {
  ActiveSession,
  AuthRepository,
  NewGoogleLogin,
  OauthStateRecord
} from "./auth.repository.js";
import { planGoogleLogin } from "./google-login.js";

export type MemoryUser = UserProfile & {
  readonly deletedAt: Date | null;
  readonly weatherLocation?: StoredWeatherLocation | null;
};

export type MemoryAccount = {
  readonly id: string;
  readonly userId: string;
  readonly providerUserId: string;
  readonly encryptedAccessToken: string;
  readonly encryptedRefreshToken: string | null;
  readonly scope: readonly string[];
  readonly expiresAt: Date | null;
};

export type MemorySession = {
  readonly id: string;
  readonly userId: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
  revokedAt: Date | null;
};

export type MemoryOauthState = {
  readonly tokenHash: string;
  readonly encryptedPayload: string;
  readonly expiresAt: Date;
  consumedAt: Date | null;
};

export type MemoryDatabase = {
  readonly users: Map<string, MemoryUser>;
  readonly accounts: Map<string, MemoryAccount>;
  readonly sessions: Map<string, MemorySession>;
  readonly states: Map<string, MemoryOauthState>;
};

export function createMemoryDatabase(): MemoryDatabase {
  return {
    users: new Map(),
    accounts: new Map(),
    sessions: new Map(),
    states: new Map()
  };
}

export class MemoryAuthRepository implements AuthRepository {
  constructor(private readonly database: MemoryDatabase) {}

  async saveOauthState(input: OauthStateRecord): Promise<void> {
    if (this.database.states.has(input.tokenHash)) {
      throw Object.assign(new Error("Повтор состояния входа"), { code: 11000 });
    }

    this.database.states.set(input.tokenHash, {
      tokenHash: input.tokenHash,
      encryptedPayload: input.encryptedPayload,
      expiresAt: input.expiresAt,
      consumedAt: null
    });
  }

  async consumeOauthState(
    tokenHash: string,
    now: Date
  ): Promise<{ encryptedPayload: string } | null> {
    const state = this.database.states.get(tokenHash);

    if (!state || state.consumedAt !== null || state.expiresAt.getTime() <= now.getTime()) {
      return null;
    }

    state.consumedAt = now;
    return { encryptedPayload: state.encryptedPayload };
  }

  async completeGoogleLogin(input: NewGoogleLogin): Promise<ActiveSession> {
    const existing = [...this.database.accounts.values()].find(
      (account) => account.providerUserId === input.providerUserId
    );
    const existingUser = existing ? this.activeUser(existing.userId) : null;
    const plan = planGoogleLogin(
      existing ? { accountId: existing.id, user: existingUser } : null,
      input.avatarUrl
    );

    if (plan.type === "blocked") {
      throw new GoogleAccountBlockedError();
    }

    const profile =
      plan.type === "create" ? this.insertUser(input) : this.updateUser(existing, plan, input);

    if (!profile) {
      throw new GoogleAccountBlockedError();
    }

    const sessionId = randomBytes(12).toString("hex");
    this.database.sessions.set(input.tokenHash, {
      id: sessionId,
      userId: profile.id,
      tokenHash: input.tokenHash,
      expiresAt: input.sessionExpiresAt,
      revokedAt: null
    });

    return { sessionId, user: profile, expiresAt: input.sessionExpiresAt };
  }

  async findActiveSession(tokenHash: string, now: Date): Promise<ActiveSession | null> {
    const session = this.database.sessions.get(tokenHash);

    if (!session || session.revokedAt !== null || session.expiresAt.getTime() <= now.getTime()) {
      return null;
    }

    const user = this.activeUser(session.userId);

    if (!user) {
      return null;
    }

    return { sessionId: session.id, user, expiresAt: session.expiresAt };
  }

  async revokeSession(sessionId: string, now: Date): Promise<void> {
    for (const session of this.database.sessions.values()) {
      if (session.id === sessionId && session.revokedAt === null) {
        session.revokedAt = now;
      }
    }
  }

  private activeUser(userId: string): UserProfile | null {
    const user = this.database.users.get(userId);

    if (!user || user.deletedAt !== null) {
      return null;
    }

    return user;
  }

  private insertUser(input: NewGoogleLogin): UserProfile {
    const id = randomBytes(12).toString("hex");
    const profile: MemoryUser = {
      id,
      displayName: input.displayName,
      avatarUrl: input.avatarUrl,
      locale: input.locale,
      timezone: NEW_USER_DEFAULTS.timezone,
      timeFormat: NEW_USER_DEFAULTS.timeFormat,
      theme: NEW_USER_DEFAULTS.theme,
      createdAt: input.now,
      updatedAt: input.now,
      deletedAt: null
    };
    this.database.users.set(id, profile);
    this.database.accounts.set(id, {
      id,
      userId: id,
      providerUserId: input.providerUserId,
      encryptedAccessToken: input.encryptedAccessToken,
      encryptedRefreshToken: input.encryptedRefreshToken,
      scope: input.scope,
      expiresAt: input.tokenExpiresAt
    });
    return profile;
  }

  private updateUser(
    existing: MemoryAccount | undefined,
    plan: Extract<ReturnType<typeof planGoogleLogin>, { type: "update" }>,
    input: NewGoogleLogin
  ): UserProfile | null {
    if (!existing) {
      return null;
    }

    this.database.accounts.set(existing.userId, {
      ...existing,
      encryptedAccessToken: input.encryptedAccessToken,
      encryptedRefreshToken: input.encryptedRefreshToken,
      scope: input.scope,
      expiresAt: input.tokenExpiresAt
    });
    const current = this.database.users.get(plan.user.id);

    if (!current || current.deletedAt !== null) {
      return null;
    }

    if (!plan.replaceAvatar) {
      return current;
    }

    const updated: MemoryUser = {
      ...current,
      avatarUrl: input.avatarUrl,
      updatedAt: input.now
    };
    this.database.users.set(current.id, updated);
    return updated;
  }
}

export class MemoryUsersRepository implements UsersRepository {
  constructor(private readonly database: MemoryDatabase) {}

  async findActive(userId: string): Promise<UserProfile | null> {
    const user = this.database.users.get(userId);

    if (!user || user.deletedAt !== null || user.id !== userId) {
      return null;
    }

    return user;
  }

  async update(userId: string, patch: ProfileUpdate, now: Date): Promise<UserProfile | null> {
    const user = this.database.users.get(userId);

    if (!user || user.deletedAt !== null || user.id !== userId) {
      return null;
    }

    const updated: MemoryUser = {
      ...user,
      ...definedPatch(patch),
      id: user.id,
      updatedAt: now
    };
    this.database.users.set(userId, updated);
    return updated;
  }

  async softDelete(userId: string, now: Date) {
    const user = this.database.users.get(userId);

    if (!user || user.id !== userId) {
      return "missing" as const;
    }

    if (user.deletedAt !== null) {
      return "already-deleted" as const;
    }

    this.database.users.set(userId, { ...user, deletedAt: now, updatedAt: now });
    return "deleted" as const;
  }

  async restore(userId: string, now: Date): Promise<void> {
    const user = this.database.users.get(userId);

    if (!user || user.deletedAt === null) {
      return;
    }

    this.database.users.set(userId, { ...user, deletedAt: null, updatedAt: now });
  }

  async readWeatherLocation(userId: string): Promise<StoredWeatherLocation | null> {
    const user = this.database.users.get(userId);

    if (!user || user.deletedAt !== null || user.id !== userId) {
      return null;
    }

    return user.weatherLocation ?? null;
  }

  async writeWeatherLocation(
    userId: string,
    location: StoredWeatherLocation | null,
    now: Date
  ): Promise<boolean> {
    const user = this.database.users.get(userId);

    if (!user || user.deletedAt !== null || user.id !== userId) {
      return false;
    }

    this.database.users.set(userId, { ...user, weatherLocation: location, updatedAt: now });
    return true;
  }
}

export function purgeMemoryUser(database: MemoryDatabase, userId: string): void {
  const user = database.users.get(userId);

  if (!user || user.deletedAt === null) {
    throw new Error("Активный аккаунт не удаляется физически");
  }

  database.users.delete(userId);

  for (const [key, account] of database.accounts) {
    if (account.userId === userId) {
      database.accounts.delete(key);
    }
  }

  for (const [key, session] of database.sessions) {
    if (session.userId === userId) {
      database.sessions.delete(key);
    }
  }
}

function definedPatch(patch: ProfileUpdate): ProfileUpdate {
  const update: {
    displayName?: string;
    locale?: string;
    timezone?: string;
    timeFormat?: UserProfile["timeFormat"];
    theme?: UserProfile["theme"];
  } = {};

  if (patch.displayName !== undefined) {
    update.displayName = patch.displayName;
  }

  if (patch.locale !== undefined) {
    update.locale = patch.locale;
  }

  if (patch.timezone !== undefined) {
    update.timezone = patch.timezone;
  }

  if (patch.timeFormat !== undefined) {
    update.timeFormat = patch.timeFormat;
  }

  if (patch.theme !== undefined) {
    update.theme = patch.theme;
  }

  return update;
}
