import { describe, expect, it } from 'vitest';

import {
  listLinkLoomToolMappings,
  isMappedLinkLoomTool,
  resolveLinkLoomToolIdentity,
} from '../adapters/api/mappers/toolIdentityMapper';
import { APPLICATION_CONSOLE_AGENT_IDS } from './applicationConsoleAgents';
import { TOOLSET_IDS, resolveRegistryToolsetId } from './constants/toolsetIdentifiers';
import { ADMIN_DISPATCH_TOOL_IDS } from './constants/adminExclusiveTools';
import { buildToolCategoryMap } from './types/skill';

const LLM_FACING_ADMIN_TOOLS = [
  'platform_discover',
  'platform_invoke',
  'create_cron',
  'trigger_scoring',
  'generate_daily_report',
  'publish_report',
  'run_workflow',
  'decide_workflow_step',
  'update_news_score',
  'rebuild_hot_snapshot',
];

describe('admin toolset identity', () => {
  it('TOOLSET_IDS.ADMIN is linkloom-admin', () => {
    expect(TOOLSET_IDS.ADMIN).toBe('linkloom-admin');
  });

  it('resolveRegistryToolsetId passes linkloom-admin through', () => {
    expect(resolveRegistryToolsetId('linkloom-admin')).toBe('linkloom-admin');
  });

  it('maps create_cron to ADMIN toolset + createCron apiName', () => {
    const id = resolveLinkLoomToolIdentity({ toolName: 'create_cron' });
    expect(id.identifier).toBe('linkloom-admin');
    expect(id.apiName).toBe('createCron');
  });

  it('maps platform primitives and dispatch tools', () => {
    for (const name of [...LLM_FACING_ADMIN_TOOLS, ...ADMIN_DISPATCH_TOOL_IDS]) {
      expect(isMappedLinkLoomTool(name)).toBe(true);
      const id = resolveLinkLoomToolIdentity({ toolName: name });
      expect(id.identifier).toBe('linkloom-admin');
    }
  });

  it('admin mappings include platform + legacy', () => {
    const adminMappings = listLinkLoomToolMappings().filter((m) => m.identifier === 'linkloom-admin');
    expect(adminMappings.length).toBeGreaterThanOrEqual(70);
  });

  it('LLM-facing admin tools belong to a TOOL_CATEGORIES group', () => {
    const categoryMap = buildToolCategoryMap();
    const uncategorized = LLM_FACING_ADMIN_TOOLS.filter((name) => !categoryMap.has(name));
    expect(uncategorized).toEqual([]);
  });

  it('query_knowledge and query_memory remain editorial toolset mappings', () => {
    expect(resolveLinkLoomToolIdentity({ toolName: 'query_knowledge' }).identifier).toBe(
      'linkloom-knowledge-base',
    );
    expect(resolveLinkLoomToolIdentity({ toolName: 'query_memory' }).identifier).toBe(
      'linkloom-user-memory',
    );
  });

  it('APPLICATION_CONSOLE_AGENT_IDS includes super_admin', () => {
    expect(APPLICATION_CONSOLE_AGENT_IDS).toContain('super_admin');
  });
});
