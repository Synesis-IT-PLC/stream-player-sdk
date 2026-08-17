export type JwtPayload = {
  sub?: string;
  email?: string;
  client_id?: string;
  exp?: number;
  iat?: number;
  [key: string]: unknown;
};

export function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    return JSON.parse(atob(padded)) as JwtPayload;
  } catch {
    return null;
  }
}

export function getClientIdFromToken(token: string): string | null {
  const clientId = decodeJwtPayload(token)?.client_id;
  return typeof clientId === 'string' && clientId ? clientId : null;
}

export function getEmailFromToken(token: string): string | null {
  const payload = decodeJwtPayload(token);
  const email = payload?.email || payload?.sub;
  return typeof email === 'string' && email ? email : null;
}

export function isJwtExpired(token: string, nowMs = Date.now()): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload) return true;
  if (typeof payload.exp !== 'number') return false;
  return payload.exp * 1000 <= nowMs;
}
