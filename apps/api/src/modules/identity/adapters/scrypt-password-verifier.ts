import { scrypt, timingSafeEqual } from "node:crypto";
import type { PasswordVerifier } from "../ports/index.js";

function derive(
  password: string,
  salt: Buffer,
  length: number,
  options: { N: number; r: number; p: number; maxmem: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, length, options, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
}
const DUMMY_HASH =
  "$scrypt$16384$8$1$YXV0aC1kdW1teS1zYWx0$yNQ2sR+uXjCKhOMJcC6YSpQ2UqQH3G73cUjYfWZcRnw=";

export class ScryptPasswordVerifier implements PasswordVerifier {
  async verify(password: string, encodedHash: string): Promise<boolean> {
    try {
      const [, algorithm, n, r, p, salt, expected] = encodedHash.split("$");
      if (algorithm !== "scrypt" || !n || !r || !p || !salt || !expected) {
        return false;
      }
      const expectedBytes = Buffer.from(expected, "base64");
      const actual = (await derive(
        password,
        Buffer.from(salt, "base64"),
        expectedBytes.length,
        {
          N: Number(n),
          r: Number(r),
          p: Number(p),
          maxmem: 64 * 1024 * 1024,
        },
      )) as Buffer;
      return (
        actual.length === expectedBytes.length &&
        timingSafeEqual(actual, expectedBytes)
      );
    } catch {
      return false;
    }
  }

  async verifyDummy(password: string): Promise<boolean> {
    await this.verify(password, DUMMY_HASH);
    return false;
  }
}
