import { scrypt } from "node:crypto";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { ScryptPasswordVerifier } from "../../src/modules/identity/adapters/scrypt-password-verifier.js";

describe("ScryptPasswordVerifier", () => {
  it("verifies supported hashes and rejects wrong passwords", async () => {
    const salt = Buffer.from("identity-test-salt");
    const derived = (await promisify(scrypt)(
      "correct-password",
      salt,
      32,
    )) as Buffer;
    const hash = `$scrypt$16384$8$1$${salt.toString("base64")}$${derived.toString("base64")}`;
    const verifier = new ScryptPasswordVerifier();

    await expect(verifier.verify("correct-password", hash)).resolves.toBe(true);
    await expect(verifier.verify("wrong-password", hash)).resolves.toBe(false);
  });

  it("performs dummy verification but never accepts a missing account", async () => {
    await expect(
      new ScryptPasswordVerifier().verifyDummy("anything"),
    ).resolves.toBe(false);
  });
});
