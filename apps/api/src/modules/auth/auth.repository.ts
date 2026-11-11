import { ObjectId, type ClientSession, type Collection, type Db } from "mongodb";

import type {
  AuthAccountDocument,
  OneTimeTokenDocument,
  SessionDocument,
  UserDocument
} from "../../infrastructure/mongodb/collection-catalog.js";
import { parseObjectId } from "../../shared/object-id.js";
import { NEW_USER_DEFAULTS, toUserProfile, type UserProfile } from "../users/user-profile.js";
import { GoogleAccountBlockedError } from "./auth.types.js";
import { planGoogleLogin } from "./google-login.js";

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

export class MongoAuthRepository implements AuthRepository {
  constructor(private readonly db: Db) {}

  async saveOauthState(input: OauthStateRecord): Promise<void> {
    await this.db.collection<OneTimeTokenDocument>("one_time_tokens").insertOne({
      _id: new ObjectId(),
      schemaVersion: 1,
      tokenHash: input.tokenHash,
      purpose: "oauth_state",
      encryptedPayload: input.encryptedPayload,
      expiresAt: input.expiresAt,
      createdAt: input.now,
      consumedAt: null
    });
  }

  async consumeOauthState(
    tokenHash: string,
    now: Date
  ): Promise<{ encryptedPayload: string } | null> {
    const document = await this.db
      .collection<OneTimeTokenDocument>("one_time_tokens")
      .findOneAndUpdate(
        { tokenHash, purpose: "oauth_state", consumedAt: null, expiresAt: { $gt: now } },
        { $set: { consumedAt: now } },
        { returnDocument: "before" }
      );

    return document ? { encryptedPayload: document.encryptedPayload } : null;
  }

  async completeGoogleLogin(input: NewGoogleLogin): Promise<ActiveSession> {
    try {
      return await this.writeLogin(input);
    } catch (error) {
      if (!isDuplicateKey(error)) {
        throw error;
      }

      // Повтор после отката транзакции присоединяется к уже созданному аккаунту.
      return this.writeLogin(input);
    }
  }

  async findActiveSession(tokenHash: string, now: Date): Promise<ActiveSession | null> {
    const session = await this.db.collection<SessionDocument>("sessions").findOne({
      tokenHash,
      revokedAt: null,
      expiresAt: { $gt: now }
    });

    if (!session) {
      return null;
    }

    const user = await this.db.collection<UserDocument>("users").findOne({
      _id: session.userId,
      deletedAt: null
    });

    if (!user) {
      return null;
    }

    return {
      sessionId: session._id.toHexString(),
      user: toUserProfile(user),
      expiresAt: session.expiresAt
    };
  }

  async revokeSession(sessionId: string, now: Date): Promise<void> {
    const id = parseObjectId(sessionId);

    if (!id) {
      return;
    }

    await this.db
      .collection<SessionDocument>("sessions")
      .updateOne({ _id: id, revokedAt: null }, { $set: { revokedAt: now } });
  }

  // Пользователь, Google-аккаунт и сессия пишутся одной транзакцией.
  private async writeLogin(input: NewGoogleLogin): Promise<ActiveSession> {
    const session = this.db.client.startSession();

    try {
      return await session.withTransaction(() => this.applyLogin(input, session));
    } finally {
      await session.endSession();
    }
  }

  private async applyLogin(input: NewGoogleLogin, session: ClientSession): Promise<ActiveSession> {
    const accounts = this.db.collection<AuthAccountDocument>("auth_accounts");
    const users = this.db.collection<UserDocument>("users");
    const sessions = this.db.collection<SessionDocument>("sessions");
    const existing = await accounts.findOne(
      { provider: "google", providerUserId: input.providerUserId },
      { session }
    );
    const existingUser = existing
      ? await users.findOne({ _id: existing.userId, deletedAt: null }, { session })
      : null;
    const plan = planGoogleLogin(
      existing
        ? {
            accountId: existing._id.toHexString(),
            user: existingUser ? toUserProfile(existingUser) : null
          }
        : null,
      input.avatarUrl
    );

    if (plan.type === "blocked") {
      throw new GoogleAccountBlockedError();
    }

    const userId = plan.type === "create" ? new ObjectId() : requiredId(plan.user.id);
    const profile =
      plan.type === "create"
        ? await insertGoogleUser(users, accounts, userId, input, session)
        : await updateGoogleUser(users, accounts, userId, plan, input, session);
    const sessionId = new ObjectId();

    await sessions.insertOne(
      {
        _id: sessionId,
        schemaVersion: 1,
        userId,
        tokenHash: input.tokenHash,
        expiresAt: input.sessionExpiresAt,
        createdAt: input.now,
        revokedAt: null
      },
      { session }
    );

    return { sessionId: sessionId.toHexString(), user: profile, expiresAt: input.sessionExpiresAt };
  }
}

async function insertGoogleUser(
  users: Collection<UserDocument>,
  accounts: Collection<AuthAccountDocument>,
  userId: ObjectId,
  input: NewGoogleLogin,
  session: ClientSession
): Promise<UserProfile> {
  const document: UserDocument = {
    _id: userId,
    schemaVersion: 1,
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
  await users.insertOne(document, { session });
  await accounts.insertOne(googleAccount(new ObjectId(), userId, input), { session });
  return toUserProfile(document);
}

function googleAccount(id: ObjectId, userId: ObjectId, input: NewGoogleLogin): AuthAccountDocument {
  return {
    _id: id,
    schemaVersion: 1,
    userId,
    provider: "google",
    providerUserId: input.providerUserId,
    encryptedAccessToken: input.encryptedAccessToken,
    encryptedRefreshToken: input.encryptedRefreshToken,
    scope: [...input.scope],
    expiresAt: input.tokenExpiresAt,
    createdAt: input.now,
    updatedAt: input.now
  };
}

async function updateGoogleUser(
  users: Collection<UserDocument>,
  accounts: Collection<AuthAccountDocument>,
  userId: ObjectId,
  plan: Extract<ReturnType<typeof planGoogleLogin>, { type: "update" }>,
  input: NewGoogleLogin,
  session: ClientSession
): Promise<UserProfile> {
  await accounts.updateOne(
    { _id: requiredId(plan.accountId) },
    {
      $set: {
        encryptedAccessToken: input.encryptedAccessToken,
        encryptedRefreshToken: input.encryptedRefreshToken,
        scope: [...input.scope],
        expiresAt: input.tokenExpiresAt,
        updatedAt: input.now
      }
    },
    { session }
  );

  if (!plan.replaceAvatar) {
    return plan.user;
  }

  await users.updateOne(
    { _id: userId, deletedAt: null },
    { $set: { avatarUrl: input.avatarUrl, updatedAt: input.now } },
    { session }
  );

  return { ...plan.user, avatarUrl: input.avatarUrl, updatedAt: input.now };
}

function requiredId(id: string): ObjectId {
  const objectId = parseObjectId(id);

  if (!objectId) {
    throw new Error("Некорректный идентификатор пользователя");
  }

  return objectId;
}

function isDuplicateKey(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  if ("code" in error && error.code === 11000) {
    return true;
  }

  return "cause" in error && isDuplicateKey(error.cause);
}
