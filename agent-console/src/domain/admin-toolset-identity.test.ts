import { describe, expect, it } from 'vitest';

import {
  listLinkLoomToolMappings,
  isMappedLinkLoomTool,
  resolveLinkLoomToolIdentity,
} from '../adapters/api/mappers/toolIdentityMapper';
import { APPLICATION_CONSOLE_AGENT_IDS } from './applicationConsoleAgents';
import { TOOLSET_IDS, resolveRegistryToolsetId } from './constants/toolsetIdentifiers';
import { buildToolCategoryMap } from './types/skill';

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

  it('maps all 70 admin tools', () => {
    const names = [
      'list_schedules',
      'list_adapters',
      'list_workflows',
      'list_unevaluated_news',
      'list_scored_news',
      'get_news_item',
      'list_workflow_runs',
      'get_system_stats',
      'list_recent_reports',
      'create_cron',
      'update_cron',
      'delete_cron',
      'run_schedule_now',
      'run_workflow',
      'trigger_scoring',
      'decide_workflow_step',
      'update_news_score',
      'delete_news',
      'generate_daily_report',
      'publish_report',
      'list_task_logs',
      'get_schedule_detail',
      'get_adapter_config',
      'sync_adapter',
      'clear_adapter_data',
      'list_processed_news',
      'get_selection_stats',
      'query_continuation_report',
      'get_daily_report_json',
      'list_report_json_dates',
      'get_digest_context',
      'refresh_digest_context',
      'get_aggregated_content',
      'get_workflow_run_detail',
      'get_workflow_run',
      'list_pending_approvals',
      'get_platform_status',
      'get_governance_status',
      'get_agent_metrics',
      'get_commit_history',
      'get_publication_items',
      'republish_report',
      'delete_commit_history',
      'list_agents',
      'get_agent',
      'list_skills',
      'scan_skills',
      'list_tools',
      'list_mcp_configs',
      'test_mcp',
      'list_workflow_templates',
      'list_agent_bindings',
      'list_kb_categories',
      'list_kb_documents',
      'get_kb_content',
      'list_memory_categories',
      'get_rag_status',
      'list_plugin_metadata',
      'save_agent',
      'delete_agent',
      'save_workflow',
      'instantiate_template',
      'get_settings',
      'update_settings',
      'test_ai_provider',
      'create_api_key',
      'create_kb_category',
      'delete_kb_document',
      'batch_reset_scoring',
      'backfill_publication_items',
    ];
    for (const name of names) {
      expect(isMappedLinkLoomTool(name)).toBe(true);
      const id = resolveLinkLoomToolIdentity({ toolName: name });
      expect(id.identifier).toBe('linkloom-admin');
    }
  });

  it('admin mappings count is 70', () => {
    const adminMappings = listLinkLoomToolMappings().filter((m) => m.identifier === 'linkloom-admin');
    expect(adminMappings).toHaveLength(70);
  });

  it('all admin tools belong to a TOOL_CATEGORIES group', () => {
    const categoryMap = buildToolCategoryMap();
    const adminNames = listLinkLoomToolMappings()
      .filter((m) => m.identifier === 'linkloom-admin')
      .flatMap((m) => m.keys);
    const uncategorized = adminNames.filter((name) => !categoryMap.has(name));
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
