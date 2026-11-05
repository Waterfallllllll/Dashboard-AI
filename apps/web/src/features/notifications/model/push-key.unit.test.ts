import { describe, expect, it } from "vitest";

import { decodeVapidPublicKey } from "./push-key";

describe("decodeVapidPublicKey", () => {
  it("принимает несжатый публичный ключ P-256 и отклоняет мусор", () => {
    const bytes = Uint8Array.from({ length: 65 }, (_, index) => (index === 0 ? 4 : index));
    const key = Buffer.from(bytes).toString("base64url");

    const compressed = Uint8Array.from(bytes);
    compressed[0] = 2;

    expect(decodeVapidPublicKey(key)).toEqual(bytes);
    expect(decodeVapidPublicKey("")).toBeNull();
    expect(decodeVapidPublicKey(`${key}==`)).toBeNull();
    expect(decodeVapidPublicKey(Buffer.from(compressed).toString("base64url"))).toBeNull();
  });
});
