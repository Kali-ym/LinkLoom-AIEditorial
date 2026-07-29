import { beforeEach, describe, expect, it } from 'vitest';
import { ToolRegistry } from '../src/registries/ToolRegistry.js';
import { selectionTools } from '../src/plugins/builtin/tools/admin/selectionTools.js';
import { knowledgeTools } from '../src/plugins/builtin/tools/admin/knowledgeTools.js';
import { agentRunAdminTools } from '../src/plugins/builtin/tools/admin/agentRunAdminTools.js';
import {
  discoverPlatformOperations,
  resolvePlatformOperation,
} from '../src/plugins/builtin/tools/admin/platformApiCatalog.js';

describe('platform catalog phase1 A+B', () => {
  beforeEach(() => {
    ToolRegistry['instance'] = undefined;
    const registry = ToolRegistry.getInstance();
    for (const tool of [...selectionTools, ...knowledgeTools, ...agentRunAdminTools]) {
      registry.registerTool(tool);
    }
  });

  it('resolves true feed admin paths and aliases to same tools', () => {
    expect(resolvePlatformOperation('GET', '/api/feed/admin/stats')?.operation.toolId).toBe(
      'get_selection_stats',
    );
    expect(resolvePlatformOperation('GET', '/api/feed/admin/raw')?.operation.toolId).toBe(
      'list_raw_news',
    );
    expect(resolvePlatformOperation('GET', '/api/feed/admin/items/n1')?.operation.toolId).toBe(
      'get_news_item',
    );
    expect(resolvePlatformOperation('GET', '/api/feed/admin/news/n1')?.operation.toolId).toBe(
      'get_news_item',
    );
    const patch = resolvePlatformOperation('PATCH', '/api/feed/admin/scoring/n1');
    expect(patch?.operation.toolId).toBe('update_news_score');
    expect(
      patch?.operation.mapArgs?.({
        params: { id: 'n1' },
        query: {},
        body: { score: 88 },
      }),
    ).toEqual({ newsId: 'n1', action: 'patch', score: 88 });
    expect(
      resolvePlatformOperation('POST', '/api/feed/admin/scoring/n1/reset')?.operation.mapArgs?.({
        params: { id: 'n1' },
        query: {},
        body: {},
      }),
    ).toEqual({ newsId: 'n1', action: 'reset' });
    expect(resolvePlatformOperation('POST', '/api/adapters/import-opml')?.operation.toolId).toBe(
      'import_opml',
    );
    expect(resolvePlatformOperation('DELETE', '/api/workflows/wf1')?.operation.toolId).toBe(
      'delete_workflow',
    );
    expect(resolvePlatformOperation('POST', '/api/workflows/dry-run-step')?.operation.toolId).toBe(
      'dry_run_workflow_step',
    );
  });

  it('resolves agent-runs and rag ops paths', () => {
    expect(resolvePlatformOperation('GET', '/api/agent-runs')?.operation.toolId).toBe(
      'list_agent_runs',
    );
    expect(resolvePlatformOperation('GET', '/api/agent-runs/hitl/pending')?.operation.toolId).toBe(
      'list_pending_agent_hitl',
    );
    expect(
      resolvePlatformOperation('POST', '/api/agent-runs/r1/cancel')?.operation.toolId,
    ).toBe('cancel_agent_run');
    expect(resolvePlatformOperation('POST', '/api/rag/reindex')?.operation.toolId).toBe(
      'rag_reindex',
    );
    expect(resolvePlatformOperation('GET', '/api/rag/jobs')?.operation.toolId).toBe('list_rag_jobs');
  });

  it('auto-details when prefix is narrow', () => {
    const feed = discoverPlatformOperations({ prefix: '/api/feed/admin/raw' });
    expect(feed.detail).toBe(true);
    expect(feed.operations[0]).toMatchObject({
      path: '/api/feed/admin/raw',
      toolId: 'list_raw_news',
    });
    const runs = discoverPlatformOperations({ prefix: '/api/agent-runs', q: 'hitl' });
    expect(runs.detail).toBe(true);
    expect(runs.operations.some((op) => op.path.includes('hitl'))).toBe(true);
  });
});
