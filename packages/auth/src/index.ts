import { createHash, randomBytes } from 'crypto';

export function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

export function generateMagicLinkToken(): string {
  return randomBytes(32).toString('hex');
}

export function generatePortalToken(): string {
  return randomBytes(24).toString('base64url');
}

export function hashPassword(password: string): string {
  // NOTE: In production, replace with bcrypt
  // bcrypt is not included here to avoid native module issues in monorepo
  // The API layer should use bcrypt directly
  const salt = randomBytes(16).toString('hex');
  const hash = createHash('sha256').update(password + salt).digest('hex');
  return `sha256:${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  if (stored.startsWith('sha256:')) {
    const [, salt, hash] = stored.split(':');
    const computed = createHash('sha256').update(password + salt).digest('hex');
    return computed === hash;
  }
  return false;
}

export function isTokenExpired(expiresAt: Date): boolean {
  return expiresAt < new Date();
}

export function sessionExpiresAt(daysFromNow = 30): Date {
  return new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
}

export function magicLinkExpiresAt(minutesFromNow = 15): Date {
  return new Date(Date.now() + minutesFromNow * 60 * 1000);
}
