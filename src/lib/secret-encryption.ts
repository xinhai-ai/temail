import "server-only";

import crypto from "crypto";

type EncryptionResult = {
  ciphertext: string;
  iv: string;
  tag: string;
};

function loadKey(): Buffer {
  const raw = (process.env.AUTH_ENCRYPTION_KEY || "").trim();
  if (!raw) {
    throw new Error("AUTH_ENCRYPTION_KEY is not set");
  }

  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error("AUTH_ENCRYPTION_KEY must be 32 bytes (hex or base64)");
  }
  return buf;
}

export function encryptString(plaintext: string): EncryptionResult {
  const key = loadKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

export function decryptString(payload: EncryptionResult): string {
  const key = loadKey();
  const iv = Buffer.from(payload.iv, "base64");
  const tag = Buffer.from(payload.tag, "base64");
  const ciphertext = Buffer.from(payload.ciphertext, "base64");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

