/**
 * Resolve an Interop API key from `x-api-key` or `Authorization: Bearer sk_pf_…`.
 * JWT bearer tokens are ignored so they can fall through to jwtVerify.
 */
export function extractInteropApiKey(headers: {
  'x-api-key'?: string | string[];
  authorization?: string | string[];
}): string | undefined {
  const headerKey = firstHeader(headers['x-api-key']);
  if (headerKey) return headerKey;

  const authorization = firstHeader(headers.authorization);
  if (!authorization) return undefined;

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return undefined;

  const token = match[1].trim();
  if (!token.startsWith('sk_pf_')) return undefined;
  return token;
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
    const trimmed = value[0].trim();
    return trimmed || undefined;
  }
  return undefined;
}
