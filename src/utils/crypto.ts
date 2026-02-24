import { randomBytes, createHash } from 'crypto';

/**
 * Generate a secure random token (for invitations, password reset, etc.)
 */
export function generateSecureToken(length: number = 32): string {
  return randomBytes(length).toString('hex');
}

/**
 * Generate a session token
 */
export function generateSessionToken(length: number = 32): string {
  return generateSecureToken(length); // ✅ استدعاء مباشر بدون this
}

/**
 * Hash a token for secure storage (like invitation tokens)
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Hash a session token for storage
 */
export function hashSessionToken(token: string): string {
  return hashToken(token); // ✅ استدعاء مباشر بدون this
}

/**
 * Generate a random password (if needed)
 */
export function generateRandomPassword(length: number = 12): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  const bytes = randomBytes(length);
  for (let i = 0; i < length; i++) {
    password += chars[bytes[i] % chars.length];
  }
  return password;
}