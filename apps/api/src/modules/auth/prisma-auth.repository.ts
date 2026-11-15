import type { PrismaClient } from "../../generated/prisma/client.js";
import { fromTimeFormat, toTimeFormat } from "../../infrastructure/db/enum-map.js";
import { isUniqueViolation } from "../../shared/prisma-error.js";
import { newEntityId, parseUuid } from "../../shared/public-id.js";
import { NEW_USER_DEFAULTS, type UserProfile } from "../users/user-profile.js";
import type {
  ActiveSession,
  AuthRepository,
  NewGoogleLogin,
  OauthStateRecord
} from "./auth.repository.js";
import { GoogleAccountBlockedError } from "./auth.types.js";
import { planGoogleLogin } from "./google-login.js";

export class PrismaAuthRepository implements AuthRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async saveOauthState(input: OauthStateRecord): Promise<void> {
    await this.prisma.oneTimeToken.create({
      data: {
        tokenHash: input.tokenHash,
        purpose: "oauth_state",
        payload: input.encryptedPayload,
        expiresAt: input.expiresAt,
        createdAt: input.now
      }
    });
  }

  async consumeOauthState(
    tokenHash: string,
    now: Date
  ): Promise<{ encryptedPayload: string } | null> {
    return this.prisma.$transaction(async (tx) => {
      const token = await tx.oneTimeToken.findFirst({
        where: {
          tokenHash,
          purpose: "oauth_state",
          consumedAt: null,
          expiresAt: { gt: now }
        }
      });

      if (!token) {
        return null;
      }

      const consumed = await tx.oneTimeToken.updateMany({
        where: { id: token.id, consumedAt: null },
        data: { consumedAt: now }
      });
      return consumed.count === 1 ? { encryptedPayload: token.payload } : null;
    });
  }

  async completeGoogleLogin(input: NewGoogleLogin): Promise<ActiveSession> {
    try {
      return await this.writeLogin(input);
    } catch (error) {
      if (error instanceof GoogleAccountBlockedError || !isUniqueViolation(error)) {
        throw error;
      }

      return this.writeLogin(input);
    }
  }

  async findActiveSession(tokenHash: string, now: Date): Promise<ActiveSession | null> {
    const session = await this.prisma.session.findFirst({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: now } },
      include: { user: true }
    });

    if (!session || session.user.deletedAt) {
      return null;
    }

    return {
      sessionId: session.id,
      user: toProfile(session.user),
      expiresAt: session.expiresAt
    };
  }

  async revokeSession(sessionId: string, now: Date): Promise<void> {
    const id = parseUuid(sessionId);

    if (!id) {
      return;
    }

    await this.prisma.session.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: now }
    });
  }

  private async writeLogin(input: NewGoogleLogin): Promise<ActiveSession> {
    return this.prisma.$transaction((tx) => applyLogin(tx, input));
  }
}

async function applyLogin(
  tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0],
  input: NewGoogleLogin
): Promise<ActiveSession> {
  const existing = await tx.authAccount.findUnique({
    where: {
      provider_providerUserId: { provider: "google", providerUserId: input.providerUserId }
    },
    include: { user: true }
  });
  const activeUser = existing && existing.user.deletedAt === null ? existing.user : null;
  const plan = planGoogleLogin(
    existing ? { accountId: existing.id, user: activeUser ? toProfile(activeUser) : null } : null,
    input.avatarUrl
  );

  if (plan.type === "blocked") {
    throw new GoogleAccountBlockedError();
  }

  const profile =
    plan.type === "create"
      ? await insertGoogleUser(tx, input)
      : await updateGoogleUser(tx, plan, input);
  const session = await tx.session.create({
    data: {
      id: newEntityId(),
      userId: profile.id,
      tokenHash: input.tokenHash,
      expiresAt: input.sessionExpiresAt,
      createdAt: input.now
    }
  });

  return { sessionId: session.id, user: profile, expiresAt: input.sessionExpiresAt };
}

type LoginTx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

async function insertGoogleUser(tx: LoginTx, input: NewGoogleLogin): Promise<UserProfile> {
  const id = newEntityId();
  const user = await tx.user.create({
    data: {
      id,
      displayName: input.displayName,
      avatarUrl: input.avatarUrl,
      locale: input.locale,
      timezone: NEW_USER_DEFAULTS.timezone,
      timeFormat: toTimeFormat(NEW_USER_DEFAULTS.timeFormat),
      theme: NEW_USER_DEFAULTS.theme,
      createdAt: input.now,
      updatedAt: input.now,
      authAccounts: {
        create: {
          provider: "google",
          providerUserId: input.providerUserId,
          accessToken: input.encryptedAccessToken,
          refreshToken: input.encryptedRefreshToken,
          scope: [...input.scope],
          expiresAt: input.tokenExpiresAt,
          createdAt: input.now,
          updatedAt: input.now
        }
      }
    }
  });
  return toProfile(user);
}

async function updateGoogleUser(
  tx: LoginTx,
  plan: Extract<ReturnType<typeof planGoogleLogin>, { type: "update" }>,
  input: NewGoogleLogin
): Promise<UserProfile> {
  const accountId = parseUuid(plan.accountId);
  const userId = parseUuid(plan.user.id);

  if (!accountId || !userId) {
    throw new Error("Некорректный идентификатор пользователя");
  }

  await tx.authAccount.update({
    where: { id: accountId },
    data: {
      accessToken: input.encryptedAccessToken,
      refreshToken: input.encryptedRefreshToken,
      scope: [...input.scope],
      expiresAt: input.tokenExpiresAt,
      updatedAt: input.now
    }
  });

  if (!plan.replaceAvatar) {
    return plan.user;
  }

  const user = await tx.user.update({
    where: { id: userId },
    data: { avatarUrl: input.avatarUrl, updatedAt: input.now }
  });
  return toProfile(user);
}

function toProfile(row: {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  locale: string;
  timezone: string;
  timeFormat: "hour12" | "hour24";
  theme: UserProfile["theme"];
  createdAt: Date;
  updatedAt: Date;
}): UserProfile {
  return {
    id: row.id,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    locale: row.locale,
    timezone: row.timezone,
    timeFormat: fromTimeFormat(row.timeFormat),
    theme: row.theme,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}
