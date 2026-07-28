import { COMMAND_SEARCH_TYPES, type ValidSearchType } from '../../../domain/types/commandSearch';

export type { ValidSearchType };

export interface ParsedQuery {
  cleanQuery: string;
  typeFilter?: ValidSearchType;
}

/** Upstream `utils/queryParser.ts` — `type:` / `is:` 过滤器 */
export function parseSearchQuery(query: string): ParsedQuery {
  if (!query || typeof query !== 'string') {
    return { cleanQuery: '' };
  }

  let cleanQuery = query.trim();
  let typeFilter: ValidSearchType | undefined;

  const typePattern = /(?:^|\s)(type|is):(\w+)(?:\s|$)/i;
  const match = cleanQuery.match(typePattern);

  if (match) {
    const [fullMatch, , typeValue] = match;
    const normalizedType = typeValue.toLowerCase();
    const matchedType = COMMAND_SEARCH_TYPES.find((t) => t.toLowerCase() === normalizedType);
    if (matchedType) {
      typeFilter = matchedType;
      cleanQuery = cleanQuery.replace(fullMatch, ' ').trim();
    }
  }

  return {
    cleanQuery,
    typeFilter,
  };
}

export function buildQueryWithType(query: string, type: ValidSearchType): string {
  const cleanQuery = query.trim();
  return cleanQuery ? `type:${type} ${cleanQuery}` : `type:${type}`;
}
