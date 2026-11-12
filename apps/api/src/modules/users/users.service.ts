import { API_ERROR_CODES } from "@dashboard/contracts";
import type { ProfilePatch } from "@dashboard/contracts";

import { ApiError } from "../../shared/errors/api-error.js";
import { noopAudit, type AuditRecorder } from "../audit/audit.service.js";
import type { Actor } from "../auth/auth.types.js";
import type { ProfileUpdate, UserProfile } from "./user-profile.js";
import type { UsersRepository } from "./users.repository.js";

export type AccountPurge = (userId: string) => Promise<void>;

export class UsersService {
  constructor(
    private readonly users: UsersRepository,
    private readonly purge: AccountPurge,
    private readonly now: () => Date = () => new Date(),
    private readonly audit: AuditRecorder = noopAudit
  ) {}

  async getProfile(actor: Actor): Promise<UserProfile> {
    return this.ownedProfile(actor);
  }

  async updateProfile(actor: Actor, patch: ProfilePatch): Promise<UserProfile> {
    const updated = await this.users.update(actor.userId, profileUpdate(patch), this.now());
    return this.sameUser(actor, updated);
  }

  async deleteAccount(actor: Actor): Promise<void> {
    await this.ownedProfile(actor);
    const deleted = await this.users.softDelete(actor.userId, this.now());

    if (deleted === "missing") {
      throw new ApiError({ code: API_ERROR_CODES.unauthenticated });
    }

    try {
      await this.purge(actor.userId);
    } catch {
      await this.users.restore(actor.userId, this.now()).catch(() => undefined);
      throw new ApiError({ code: API_ERROR_CODES.unavailable });
    }

    await this.audit.forgetUser(actor.userId);
    await this.audit.record({ userId: null, action: "account_deleted", target: null });
  }

  private async ownedProfile(actor: Actor): Promise<UserProfile> {
    return this.sameUser(actor, await this.users.findActive(actor.userId));
  }

  private sameUser(actor: Actor, user: UserProfile | null): UserProfile {
    if (!user) {
      throw new ApiError({ code: API_ERROR_CODES.unauthenticated });
    }

    if (user.id !== actor.userId) {
      throw new ApiError({ code: API_ERROR_CODES.notFound });
    }

    return user;
  }
}

function profileUpdate(patch: ProfilePatch): ProfileUpdate {
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
