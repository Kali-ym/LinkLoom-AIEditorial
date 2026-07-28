const MIN_TOKEN_LENGTH = 2;
const CJK_TOKEN_MIN_LENGTH = 2;
const CJK_TOKEN_MAX_LENGTH = 6;

export function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[\u3000\s]+/g, ' ')
    .trim();
}

function collectCjkNgrams(text: string, bucket: Set<string>): void {
  const segments = text.match(/[\p{Script=Han}]+/gu) || [];
  for (const segment of segments) {
    if (segment.length < CJK_TOKEN_MIN_LENGTH) continue;

    for (let start = 0; start < segment.length; start += 2) {
      const pair = segment.slice(start, start + 2);
      if (pair.length >= CJK_TOKEN_MIN_LENGTH) bucket.add(pair);
    }
    for (let start = 0; start <= segment.length - 4; start += 2) {
      bucket.add(segment.slice(start, start + 4));
    }

    const maxLength = Math.min(CJK_TOKEN_MAX_LENGTH, segment.length);
    for (let size = CJK_TOKEN_MIN_LENGTH; size <= maxLength; size++) {
      for (let start = 0; start <= segment.length - size; start++) {
        bucket.add(segment.slice(start, start + size));
      }
    }
    bucket.add(segment);
  }
}

function collectWordTokens(text: string, bucket: Set<string>): void {
  const tokens = text.match(/[\p{L}\p{N}_-]+/gu) || [];
  for (const token of tokens) {
    if (/^\p{Script=Han}+$/u.test(token)) continue;
    if (token.length >= MIN_TOKEN_LENGTH) bucket.add(token);
    if (token.includes('-') || token.includes('_')) {
      for (const part of token.split(/[-_]/g)) {
        if (part.length >= MIN_TOKEN_LENGTH) bucket.add(part);
      }
    }
  }
}

export function tokenizeSearchQuery(query: string, maxTokens = 16): string[] {
  const normalized = normalizeSearchText(query);
  const uniqueTokens = new Set<string>();

  collectWordTokens(normalized, uniqueTokens);
  collectCjkNgrams(normalized, uniqueTokens);

  if (uniqueTokens.size === 0 && normalized.length >= MIN_TOKEN_LENGTH) {
    uniqueTokens.add(normalized);
  }

  return Array.from(uniqueTokens).slice(0, maxTokens);
}

/**
 * Build a PostgreSQL `plainto_tsquery` compatible query string.
 * Returns a space-separated token list suitable for `plainto_tsquery('simple', ?)`.
 */
export function buildTsQuery(query: string): string {
  const tokens = tokenizeSearchQuery(query, 12).filter((token) => /[\p{L}\p{N}_-]/u.test(token));
  return tokens.join(' ');
}

export function buildTokenLikeClauses(
  fields: string[],
  tokens: string[],
  params: any[]
): string[] {
  return tokens.flatMap((token) =>
    fields.map((field) => {
      params.push(`%${token.toLowerCase()}%`);
      return `LOWER(${field}) LIKE ?`;
    })
  );
}

export function buildWeightedTokenScoreExpression(
  fields: Array<{ field: string; weight: number }>,
  tokens: string[],
  params: any[]
): string {
  const clauses = tokens.flatMap((token) =>
    fields.map(({ field, weight }) => {
      params.push(`%${token.toLowerCase()}%`);
      return `CASE WHEN LOWER(${field}) LIKE ? THEN ${weight} ELSE 0 END`;
    })
  );
  return clauses.length > 0 ? clauses.join(' + ') : '0';
}

export function makeTextSnippet(content: string, tokens: string[], radius = 80): string {
  const lowerContent = content.toLowerCase();
  const firstIndex =
    tokens
      .map((token) => lowerContent.indexOf(token.toLowerCase()))
      .filter((index) => index >= 0)
      .sort((a, b) => a - b)[0] ?? 0;

  const start = Math.max(0, firstIndex - Math.floor(radius / 2));
  const snippet = content.slice(start, start + radius * 2).trim();
  return `${start > 0 ? '...' : ''}${snippet}${start + radius * 2 < content.length ? '...' : ''}`;
}

export { parseJsonArray, parseJsonObject } from '../../shared/json.js';
