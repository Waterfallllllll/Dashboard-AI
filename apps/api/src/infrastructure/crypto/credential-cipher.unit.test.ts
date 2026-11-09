import { describe, expect, it } from "vitest";

import {
  CREDENTIAL_PURPOSES,
  CredentialCipherError,
  createCredentialCipher,
  isEncryptedSecret,
  readDataEncryptionKey
} from "./credential-cipher.js";

const keyBytes = Buffer.alloc(32, 9);

describe("шифрование credentials", () => {
  it("принимает один и тот же 32-байтовый ключ в base64, base64url и hex", () => {
    const fromBase64 = createCredentialCipher(
      readDataEncryptionKey({ DATA_ENCRYPTION_KEY: keyBytes.toString("base64") })
    );
    const fromBase64Url = createCredentialCipher(
      readDataEncryptionKey({ DATA_ENCRYPTION_KEY: keyBytes.toString("base64url") })
    );
    const fromHex = createCredentialCipher(
      readDataEncryptionKey({ DATA_ENCRYPTION_KEY: keyBytes.toString("hex") })
    );
    const payload = fromBase64.encrypt(
      '{"refreshToken":"секрет"}',
      CREDENTIAL_PURPOSES.refreshToken
    );

    expect(fromBase64Url.decrypt(payload, CREDENTIAL_PURPOSES.refreshToken)).toBe(
      '{"refreshToken":"секрет"}'
    );
    expect(fromHex.decrypt(payload, CREDENTIAL_PURPOSES.refreshToken)).toBe(
      '{"refreshToken":"секрет"}'
    );
  });

  it("не кладёт открытый секрет в ciphertext и меняет IV", () => {
    const cipher = createCredentialCipher(
      readDataEncryptionKey({ DATA_ENCRYPTION_KEY: keyBytes.toString("base64url") })
    );
    const first = cipher.encrypt("ya29.secret-access", CREDENTIAL_PURPOSES.accessToken);
    const second = cipher.encrypt("ya29.secret-access", CREDENTIAL_PURPOSES.accessToken);

    expect(first).not.toBe(second);
    expect(first).not.toContain("ya29.secret-access");
    expect(isEncryptedSecret(first)).toBe(true);
    expect(first.startsWith("enc:v1:")).toBe(true);
    expect(cipher.decrypt(first, CREDENTIAL_PURPOSES.accessToken)).toBe("ya29.secret-access");
  });

  it("не даёт подставить ciphertext одного поля в другое и отвергает подмену", () => {
    const cipher = createCredentialCipher(
      readDataEncryptionKey({ DATA_ENCRYPTION_KEY: keyBytes.toString("hex") })
    );
    const payload = cipher.encrypt('{"p256dh":"key"}', CREDENTIAL_PURPOSES.pushKeys);
    const [prefix, tag, ciphertext] = payload.split(".");
    const flipped = Buffer.from(ciphertext ?? "", "base64url");
    flipped[0] = (flipped[0] ?? 0) ^ 0xff;
    const tampered = `${prefix}.${tag}.${flipped.toString("base64url")}`;

    expect(() => cipher.decrypt(payload, CREDENTIAL_PURPOSES.integrationCredentials)).toThrow(
      CredentialCipherError
    );
    expect(() => cipher.decrypt(tampered, CREDENTIAL_PURPOSES.pushKeys)).toThrow(
      CredentialCipherError
    );
    expect(() => cipher.decrypt(payload, CREDENTIAL_PURPOSES.pushKeys)).not.toThrow();
  });

  it("отклоняет пустой ключ, пароль, пустой и повторно зашифрованный секрет", () => {
    expect(() => readDataEncryptionKey({})).toThrow(CredentialCipherError);
    expect(() => readDataEncryptionKey({ DATA_ENCRYPTION_KEY: "password" })).toThrow(
      /DATA_ENCRYPTION_KEY/
    );

    const cipher = createCredentialCipher(
      readDataEncryptionKey({ DATA_ENCRYPTION_KEY: keyBytes.toString("base64") })
    );
    const otherKey = createCredentialCipher(
      readDataEncryptionKey({ DATA_ENCRYPTION_KEY: Buffer.alloc(32, 4).toString("hex") })
    );
    const payload = cipher.encrypt("token", CREDENTIAL_PURPOSES.integrationCredentials);

    expect(() => cipher.encrypt("", CREDENTIAL_PURPOSES.accessToken)).toThrow(/Секрет/);
    expect(() => cipher.encrypt(payload, CREDENTIAL_PURPOSES.accessToken)).toThrow(/Секрет/);
    expect(() => cipher.encrypt("я".repeat(3000), CREDENTIAL_PURPOSES.accessToken)).toThrow(
      /Секрет/
    );
    expect(() => otherKey.decrypt(payload, CREDENTIAL_PURPOSES.integrationCredentials)).toThrow(
      /расшифровать/
    );
    expect(
      cipher.encrypt("я".repeat(2000), CREDENTIAL_PURPOSES.accessToken).length
    ).toBeLessThanOrEqual(8192);
  });
});
