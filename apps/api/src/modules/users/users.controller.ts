import {
  API_ERROR_CODES,
  accountDeletionResponseSchema,
  profilePatchSchema,
  profileResponseSchema
} from "@dashboard/contracts";
import type { Request, Response } from "express";

import { ApiError, parseRequest } from "../../shared/errors/api-error.js";
import { asyncHandler } from "../../shared/http/async-handler.js";
import { requestIdFrom } from "../../shared/http/request-id.js";
import { sendParsed } from "../../shared/http/respond.js";
import { profileDto, type UserProfile } from "./user-profile.js";
import type { UsersService } from "./users.service.js";

export function createUsersController(users: UsersService) {
  return {
    get: asyncHandler(async (req, res) => {
      sendProfile(res, req, await users.getProfile(requiredActor(req)));
    }),
    update: asyncHandler(async (req, res) => {
      const patch = parseRequest(profilePatchSchema, req.body);
      sendProfile(res, req, await users.updateProfile(requiredActor(req), patch));
    }),
    remove: asyncHandler(async (req, res) => {
      await users.deleteAccount(requiredActor(req));
      sendParsed(res, accountDeletionResponseSchema, 200, {
        data: { deleted: true },
        meta: { requestId: requestIdFrom(req) }
      });
    })
  };
}

function sendProfile(res: Response, req: Request, user: UserProfile): void {
  sendParsed(res, profileResponseSchema, 200, {
    data: profileDto(user),
    meta: { requestId: requestIdFrom(req) }
  });
}

function requiredActor(req: Request) {
  const actor = req.session?.actor;

  if (!actor) {
    throw new ApiError({ code: API_ERROR_CODES.unauthenticated });
  }

  return actor;
}
