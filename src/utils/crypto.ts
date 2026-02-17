// src/utils/crypto.ts
import crypto from "crypto";

export function generateSessionToken(): string {
  // 32 bytes = 256 bits
  return crypto.randomBytes(32).toString("hex");
}

export function hashSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}