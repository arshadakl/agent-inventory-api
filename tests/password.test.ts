import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "../worker/lib/password";

describe("password hashing", () => {
  it("hashes and verifies a password using the stored PBKDF2 parameters", async () => {
    const passwordHash = await hashPassword("correct horse battery staple");

    expect(passwordHash).toMatch(/^pbkdf2_sha256\$600000\$/u);
    await expect(
      verifyPassword("correct horse battery staple", passwordHash),
    ).resolves.toBe(true);
    await expect(verifyPassword("wrong password", passwordHash)).resolves.toBe(
      false,
    );
  });

  it("uses a unique salt for every password", async () => {
    const firstHash = await hashPassword("same password");
    const secondHash = await hashPassword("same password");

    expect(firstHash).not.toBe(secondHash);
  });

  it("rejects malformed hashes and oversized passwords safely", async () => {
    await expect(
      verifyPassword("password", "not-a-password-hash"),
    ).resolves.toBe(false);
    await expect(hashPassword("a".repeat(129))).rejects.toThrow(RangeError);
  });
});
