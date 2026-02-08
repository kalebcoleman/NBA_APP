import crypto from 'node:crypto';

export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function extractBearerToken(authorizationHeader: string | undefined): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(' ');
  if (!scheme || !token) {
    return null;
  }

  if (scheme.toLowerCase() !== 'bearer') {
    return null;
  }

  return token;
}
