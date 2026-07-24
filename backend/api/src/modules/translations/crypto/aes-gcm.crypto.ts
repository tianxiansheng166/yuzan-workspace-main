import { Injectable } from "@nestjs/common";
import { TranslationUnavailableException } from "../domain/translation.errors.js";

const ENV_KEY = "TRANSLATION_ENCRYPTION_KEY";

export const TRANSLATION_CRYPTO = Symbol("TRANSLATION_CRYPTO");

export interface TranslationCryptoPort {
  encrypt(plaintext: string): Promise<string>;
  decrypt(ciphertext: string): Promise<string>;
}

@Injectable()
export class AesGcmCrypto implements TranslationCryptoPort {
  private readonly key: Buffer | null = null;

  constructor() {
    const hexKey = process.env[ENV_KEY];
    if (hexKey) {
      this.key = Buffer.from(hexKey, "hex");
      if (this.key.length !== 32) {
        throw new Error(
          `${ENV_KEY} must be a 32-byte hex-encoded key (64 hex chars)`,
        );
      }
    }
  }

  async encrypt(plaintext: string): Promise<string> {
    if (!this.key) {
      throw new TranslationUnavailableException(
        "加密密钥未配置，无法存储源文本",
      );
    }

    const keyBuffer = new Uint8Array(this.key);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const algoKey = await crypto.subtle.importKey(
      "raw",
      keyBuffer,
      { name: "AES-GCM" },
      false,
      ["encrypt"],
    );

    const encoded = new TextEncoder().encode(plaintext);
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      algoKey,
      encoded,
    );

    // Concatenate: iv (12 bytes) + ciphertext+tag
    const encryptedBytes = new Uint8Array(encrypted);
    const combined = new Uint8Array(iv.length + encryptedBytes.length);
    combined.set(iv, 0);
    combined.set(encryptedBytes, iv.length);

    return Buffer.from(combined).toString("base64");
  }

  async decrypt(ciphertext: string): Promise<string> {
    if (!this.key) {
      throw new TranslationUnavailableException(
        "加密密钥未配置，无法解密源文本",
      );
    }

    const keyBuffer = new Uint8Array(this.key);
    const combined = Buffer.from(ciphertext, "base64");
    const iv = combined.subarray(0, 12);
    const encryptedData = combined.subarray(12);

    const algoKey = await crypto.subtle.importKey(
      "raw",
      keyBuffer,
      { name: "AES-GCM" },
      false,
      ["decrypt"],
    );

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      algoKey,
      encryptedData,
    );

    return new TextDecoder().decode(decrypted);
  }
}
