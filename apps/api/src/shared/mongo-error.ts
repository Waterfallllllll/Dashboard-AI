import { MongoServerError } from "mongodb";

export function isDuplicateKey(error: unknown): boolean {
  return error instanceof MongoServerError && error.code === 11000;
}

export function duplicateKeyFields(error: unknown): readonly string[] {
  if (!(error instanceof MongoServerError) || error.keyPattern === undefined) {
    return [];
  }

  return Object.keys(error.keyPattern);
}
