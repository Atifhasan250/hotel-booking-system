import { createHash, randomBytes, randomUUID } from "node:crypto";
import { argon2id, argon2Verify } from "hash-wasm";

import type { IdFactory, PasswordHasher, SecretTokenFactory } from "../../modules/identity/application/ports";

export class Argon2idPasswordHasher implements PasswordHasher {
  hash(password: string): Promise<string> {
    return argon2id({
      password,
      salt: randomBytes(16),
      parallelism: 1,
      iterations: 2,
      memorySize: 19_456,
      hashLength: 32,
      outputType: "encoded",
    });
  }

  verify(passwordHash: string, password: string): Promise<boolean> {
    return argon2Verify({ hash: passwordHash, password });
  }
}

export class CryptographicTokenFactory implements SecretTokenFactory {
  create(): { raw: string; hash: string } {
    const raw = randomBytes(32).toString("base64url");
    return { raw, hash: createHash("sha256").update(raw).digest("base64url") };
  }
}

export class RandomUuidFactory implements IdFactory {
  create(): string {
    return randomUUID();
  }
}
