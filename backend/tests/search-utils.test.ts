import { describe, expect, it } from 'vitest';
import { buildTsQuery, tokenizeSearchQuery } from '../src/services/repositories/searchUtils.js';
import { parseJsonArray, parseJsonObject, parseJsonOrFallback } from '../src/shared/json.js';

describe('searchUtils', () => {
  it('tokenizes CJK phrases into useful longer and shorter tokens', () => {
    const tokens = tokenizeSearchQuery('用户喜欢中文日报编辑规则', 30);

    expect(tokens).toContain('用户喜欢');
    expect(tokens).toContain('中文日报');
    expect(tokens).toContain('编辑规则');
    expect(tokens).toContain('日报');
  });

  it('keeps mixed English, numbers, hyphen and CJK query terms searchable', () => {
    const tokens = tokenizeSearchQuery('GPT-5 API 价格更新 中文摘要', 30);

    expect(tokens).toContain('gpt-5');
    expect(tokens).toContain('gpt');
    expect(tokens).toContain('api');
    expect(tokens).toContain('价格更新');
    expect(buildTsQuery('GPT-5 API 价格更新')).toContain('gpt-5');
  });
});

describe('shared JSON column parsers', () => {
  it('accepts PostgreSQL JSONB values that are already parsed', () => {
    expect(parseJsonArray(['偏好', 123])).toEqual(['偏好', '123']);
    expect(parseJsonObject({ summary: '中文摘要' })).toEqual({ summary: '中文摘要' });
    expect(parseJsonOrFallback({ enabled: true }, { enabled: false })).toEqual({ enabled: true });
  });

  it('keeps string JSON compatibility', () => {
    expect(parseJsonArray('["a","b"]')).toEqual(['a', 'b']);
    expect(parseJsonObject('{"summary":"命中"}')).toEqual({ summary: '命中' });
  });
});