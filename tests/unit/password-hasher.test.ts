import { describe, expect, it } from "vitest";

import { Argon2idPasswordHasher } from "../../src/platform/crypto/secrets";

describe("Argon2id password hashing", () => {
  it("stores a salted memory-hard digest and verifies without reversible data", async () => {
    const hasher = new Argon2idPasswordHasher();
    const password = "StrongPassword!42";
    const first = await hasher.hash(password);
    const second = await hasher.hash(password);
    expect(first).toMatch(/^\$argon2id\$/);
    expect(second).not.toBe(first);
    await expect(hasher.verify(first, password)).resolves.toBe(true);
    await expect(hasher.verify(first, "WrongPassword!42")).resolves.toBe(false);
  });
});
