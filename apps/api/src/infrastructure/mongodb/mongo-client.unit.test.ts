import { describe, expect, it } from "vitest";

import { readMongoConfig } from "./mongo-client.js";

describe("readMongoConfig", () => {
  it("читает уже описанные переменные и не требует новых", () => {
    expect(
      readMongoConfig({
        MONGODB_URI: "mongodb://localhost:27017/dashboard?replicaSet=rs0",
        MONGODB_DB_NAME: "dashboard",
        MONGODB_MAX_POOL_SIZE: "20"
      })
    ).toEqual({
      uri: "mongodb://localhost:27017/dashboard?replicaSet=rs0",
      dbName: "dashboard",
      maxPoolSize: 20
    });
  });

  it("отклоняет пустой адрес и размер пула вне диапазона", () => {
    expect(() => readMongoConfig({})).toThrow(/MONGODB_URI/);
    expect(() =>
      readMongoConfig({
        MONGODB_URI: "mongodb://localhost:27017/dashboard",
        MONGODB_MAX_POOL_SIZE: "0"
      })
    ).toThrow(/MONGODB_MAX_POOL_SIZE/);
  });
});
