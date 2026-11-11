import type { UserProfile } from "../users/user-profile.js";

export type ExistingGoogleAccount = {
  readonly accountId: string;
  readonly user: UserProfile | null;
};

export type GoogleLoginPlan =
  | { readonly type: "create" }
  | { readonly type: "blocked" }
  | {
      readonly type: "update";
      readonly accountId: string;
      readonly user: UserProfile;
      readonly replaceAvatar: boolean;
    };

export function planGoogleLogin(
  existing: ExistingGoogleAccount | null,
  avatarUrl: string | null
): GoogleLoginPlan {
  if (!existing) {
    return { type: "create" };
  }

  if (!existing.user) {
    return { type: "blocked" };
  }

  return {
    type: "update",
    accountId: existing.accountId,
    user: existing.user,
    replaceAvatar: existing.user.avatarUrl !== avatarUrl
  };
}
