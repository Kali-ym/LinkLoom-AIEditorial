import { beforeEach, describe, expect, it } from 'vitest';
import { ToolRegistry } from '../src/registries/ToolRegistry.js';
import { queryTools } from '../src/plugins/builtin/tools/admin/queryTools.js';
import {
  discoverPlatformOperations,
  PLATFORM_API_OPERATIONS,
} from '../src/plugins/builtin/tools/admin/platformApiCatalog.js';

describe('discoverPlatformOperations', () => {
  beforeEach(() => {
    ToolRegistry['instance'] = undefined;
    const registry = ToolRegistry.getInstance();
    for (const tool of queryTools) {
      registry.registerTool(tool);
    }
  });

  it('returns compact index for broad prefix', () => {
    const result = discoverPlatformOperations({ prefix: '/api', limit: 20 });
    expect(result.detail).toBe(false);
    expect(result.count).toBe(PLATFORM_API_OPERATIONS.length);
    expect(result.operations).toHaveLength(20);
    expect(result.truncated).toBe(true);
    expect(result.operations[0]).toMatchObject({
      method: expect.any(String),
      path: expect.any(String),
      summary: expect.any(String),
      riskLevel: expect.any(String),
      pathParams: expect.any(Array),
    });
    expect(result.operations[0]).not.toHaveProperty('args');
    expect(result.hint).toContain('detail:true');
  });

  it('auto-expands detail when matches are few', () => {
    const result = discoverPlatformOperations({ prefix: '/api/feed/admin/scored' });
    expect(result.detail).toBe(true);
    expect(result.count).toBeGreaterThanOrEqual(1);
    const scored = result.operations.find((op) => op.path === '/api/feed/admin/scored');
    expect(scored).toMatchObject({
      method: 'GET',
      summary: '列已评分新闻',
      toolId: 'list_scored_news',
      how: expect.stringContaining('query'),
    });
    expect(scored).toHaveProperty('description');
    expect((scored as { args?: Record<string, string> }).args).toMatchObject({
      dateRange: expect.stringContaining('string'),
      scoreRange: expect.stringContaining('string'),
    });
  });

  it('filters by method and keyword q', () => {
    const result = discoverPlatformOperations({
      prefix: '/api/feed',
      method: 'GET',
      q: 'scored',
    });
    expect(result.detail).toBe(true);
    expect(result.operations.every((op) => op.method === 'GET')).toBe(true);
    expect(result.operations.some((op) => op.path.includes('scored'))).toBe(true);
  });

  it('forces detail when detail:true even for broad prefix', () => {
    const result = discoverPlatformOperations({
      prefix: '/api/schedules',
      detail: true,
      limit: 3,
    });
    expect(result.detail).toBe(true);
    expect(result.operations).toHaveLength(3);
    expect(result.operations[0]).toHaveProperty('description');
    expect(result.operations[0]).toHaveProperty('how');
  });

  it('includes pathParams for templated routes', () => {
    const result = discoverPlatformOperations({
      prefix: '/api/schedules/:id',
      method: 'GET',
    });
    const op = result.operations.find((o) => o.path === '/api/schedules/:id');
    expect(op?.pathParams).toEqual(['id']);
  });
});
