import { ObjectId } from "mongodb";

export function parseObjectId(id: string): ObjectId | null {
  if (!/^[a-f0-9]{24}$/.test(id)) {
    return null;
  }

  return new ObjectId(id);
}
