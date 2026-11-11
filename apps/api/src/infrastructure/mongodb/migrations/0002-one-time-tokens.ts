import type { Db } from "mongodb";

import { ensureCollections } from "../ensure-collections.js";
import { ensureIndexes } from "../ensure-indexes.js";
import type { Migration } from "./types.js";

export const oneTimeTokensMigration: Migration = {
  version: 2,
  name: "one-time-tokens",
  async up(db: Db) {
    await ensureCollections(db);
    await ensureIndexes(db);
  }
};
