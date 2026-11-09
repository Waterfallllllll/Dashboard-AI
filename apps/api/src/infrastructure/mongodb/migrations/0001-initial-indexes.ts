import type { Db } from "mongodb";

import { ensureCollections } from "../ensure-collections.js";
import { ensureIndexes } from "../ensure-indexes.js";
import type { Migration } from "./types.js";

export const initialIndexesMigration: Migration = {
  version: 1,
  name: "initial-indexes",
  async up(db: Db) {
    await ensureCollections(db);
    await ensureIndexes(db);
  }
};
