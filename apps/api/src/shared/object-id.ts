import { ObjectId } from "mongodb";

import { parseUuid } from "./public-id.js";

export function parseObjectId(id: string): ObjectId | null {
  if (!/^[a-f0-9]{24}$/.test(id)) {
    return null;
  }

  return new ObjectId(id);
}

export function parseStoredEntityId(id: string): ObjectId | string | null {
  return parseObjectId(id) ?? parseUuid(id);
}

export function storedEntityIdText(id: ObjectId | string): string {
  return id instanceof ObjectId ? id.toHexString() : id;
}
