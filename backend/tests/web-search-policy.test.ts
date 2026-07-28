import { describe, expect, it } from 'vitest';

import {
  applyWebSearchPolicy,
  resolveWebSearchPolicy,
} from '../src/services/agents/search/WebSearchPolicyResolver.js';

describe('resolveWebSearchPolicy', () => {
  it('off mode strips all web browsing tools', () => {
    const policy = resolveWebSearchPolicy(
      { searchMode: 'off', useModelBuiltinSearch: false },
      'GEMINI',
    );
    expect(policy.effectiveMode).toBe('off');
    expect(policy.injectToolIds).toEqual([]);
    expect(policy.stripToolIds).toEqual([
      'web_search',
      'crawl_single_page',
      'crawl_multi_pages',
      'fetch_data',
    ]);
    expect(policy.enableProviderBuiltinSearch).toBe(false);
  });

  it('app mode injects full web browsing toolkit', () => {
    const policy = resolveWebSearchPolicy(
      { searchMode: 'auto', useModelBuiltinSearch: false },
      'OPENAI',
    );
    expect(policy.effectiveMode).toBe('app');
    expect(policy.injectToolIds).toEqual([
      'web_search',
      'crawl_single_page',
      'crawl_multi_pages',
      'fetch_data',
    ]);
    expect(policy.enableProviderBuiltinSearch).toBe(false);
    expect(policy.degradedFromProvider).toBe(false);
  });

  it('provider mode on GEMINI injects crawl tools only and enables builtin', () => {
    const policy = resolveWebSearchPolicy(
      { searchMode: 'auto', useModelBuiltinSearch: true },
      'GEMINI',
    );
    expect(policy.effectiveMode).toBe('provider');
    expect(policy.injectToolIds).toEqual([
      'crawl_single_page',
      'crawl_multi_pages',
      'fetch_data',
    ]);
    expect(policy.stripToolIds).toContain('web_search');
    expect(policy.enableProviderBuiltinSearch).toBe(true);
  });

  it('provider mode on non-GEMINI degrades to app', () => {
    const policy = resolveWebSearchPolicy(
      { searchMode: 'auto', useModelBuiltinSearch: true },
      'OPENAI',
    );
    expect(policy.effectiveMode).toBe('app');
    expect(policy.degradedFromProvider).toBe(true);
    expect(policy.injectToolIds).toContain('web_search');
    expect(policy.enableProviderBuiltinSearch).toBe(false);
  });

  it('defaults to off when chatConfig missing', () => {
    const policy = resolveWebSearchPolicy(undefined, 'GEMINI');
    expect(policy.effectiveMode).toBe('off');
    expect(policy.injectToolIds).toEqual([]);
    expect(policy.stripToolIds).toEqual([
      'web_search',
      'crawl_single_page',
      'crawl_multi_pages',
      'fetch_data',
    ]);
  });

  it('defaults to off when searchMode unset on chatConfig', () => {
    const policy = resolveWebSearchPolicy({ useModelBuiltinSearch: false }, 'OPENAI');
    expect(policy.effectiveMode).toBe('off');
    expect(policy.injectToolIds).toEqual([]);
  });
});

describe('applyWebSearchPolicy', () => {
  it('strips bound tools when off even if agent bound them', () => {
    const policy = resolveWebSearchPolicy({ searchMode: 'off' }, 'GEMINI');
    const next = applyWebSearchPolicy(new Set(['web_search', 'query_data']), policy);
    expect(next.has('web_search')).toBe(false);
    expect(next.has('query_data')).toBe(true);
  });

  it('injects tools when agent has no bindings', () => {
    const policy = resolveWebSearchPolicy(
      { searchMode: 'auto', useModelBuiltinSearch: false },
      'GEMINI',
    );
    const next = applyWebSearchPolicy(new Set(['query_data']), policy);
    expect(next.has('web_search')).toBe(true);
    expect(next.has('crawl_single_page')).toBe(true);
  });
});
