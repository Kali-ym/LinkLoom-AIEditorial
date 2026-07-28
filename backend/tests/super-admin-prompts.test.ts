import { describe, expect, it } from 'vitest';
import { SUPER_ADMIN_AGENT_ID, SUPER_ADMIN_PROMPT } from '../src/services/editorial/superAdminPrompts.js';
import { ADMIN_TOOLS } from '../src/plugins/builtin/tools/admin/index.js';

const KNOWN_ADMIN_TOOLS = [
  'create_cron',
  'update_cron',
  'delete_cron',
  'run_schedule_now',
  'trigger_scoring',
  'update_news_score',
  'delete_news',
  'run_workflow',
  'generate_daily_report',
  'publish_report',
  'decide_workflow_step',
  'list_task_logs',
  'sync_adapter',
  'clear_adapter_data',
  'list_processed_news',
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

const KNOWN_EDITORIAL_TOOLS = ['query_knowledge', 'query_memory'];

const KNOWN_PLAYBOOK_TOOLS = [...KNOWN_ADMIN_TOOLS, ...KNOWN_EDITORIAL_TOOLS];

describe('SUPER_ADMIN_PROMPT', () => {
  it('has correct agent id constant', () => {
    expect(SUPER_ADMIN_AGENT_ID).toBe('super_admin');
  });

  it('role mentions super admin', () => {
    expect(SUPER_ADMIN_PROMPT.role).toContain('超级管理员');
  });

  it('ADMIN_TOOLS has 70 tools', () => {
    expect(ADMIN_TOOLS).toHaveLength(70);
  });

  it('capabilities mentions 70 tools', () => {
    expect(SUPER_ADMIN_PROMPT.capabilities).toContain('70 个');
  });

  it('capabilities mentions query_knowledge and query_memory', () => {
    expect(SUPER_ADMIN_PROMPT.capabilities).toContain('query_knowledge');
    expect(SUPER_ADMIN_PROMPT.capabilities).toContain('query_memory');
  });

  it('taskPlaybook has 36 entries', () => {
    expect(SUPER_ADMIN_PROMPT.taskPlaybook).toHaveLength(36);
  });

  it('taskPlaybook includes Phase 4 entries', () => {
    const tasks = SUPER_ADMIN_PROMPT.taskPlaybook!.map((e) => e.task);
    expect(tasks).toContain('save_agent');
    expect(tasks).toContain('delete_agent');
    expect(tasks).toContain('update_settings');
    expect(tasks).toContain('create_kb_category');
    expect(tasks).toContain('batch_reset_scoring');
    expect(tasks).toContain('create_api_key');
  });

  it('taskPlaybook includes Phase 3 entries', () => {
    const tasks = SUPER_ADMIN_PROMPT.taskPlaybook!.map((e) => e.task);
    expect(tasks).toContain('list_agents');
    expect(tasks).toContain('list_skills');
    expect(tasks).toContain('list_kb_categories');
    expect(tasks).toContain('query_knowledge');
    expect(tasks).toContain('list_mcp_configs');
    expect(tasks).toContain('test_mcp');
  });

  it('every playbook entry has task/intent/params/guideOrder/tool/confirm/result', () => {
    for (const entry of SUPER_ADMIN_PROMPT.taskPlaybook!) {
      expect(entry.task).toBeTruthy();
      expect(Array.isArray(entry.intent)).toBe(true);
      expect(entry.intent.length).toBeGreaterThan(0);
      expect(Array.isArray(entry.params)).toBe(true);
      expect(Array.isArray(entry.guideOrder)).toBe(true);
      expect(entry.tool).toBeTruthy();
      expect(entry.confirm).toBeTruthy();
      expect(entry.result).toBeTruthy();
    }
  });

  it('every playbook tool maps to a known admin or editorial tool id', () => {
    for (const entry of SUPER_ADMIN_PROMPT.taskPlaybook!) {
      expect(KNOWN_PLAYBOOK_TOOLS).toContain(entry.tool);
    }
  });

  it('high-risk tasks mark 高危 in confirm', () => {
    const high = SUPER_ADMIN_PROMPT.taskPlaybook!.filter((e) =>
      [
        'delete_cron',
        'delete_news',
        'publish_report',
        'clear_adapter_data',
        'delete_commit_history',
        'delete_agent',
        'update_settings',
      ].includes(e.tool),
    );
    for (const entry of high) expect(entry.confirm).toContain('高危');
  });

  it('has at least 2 examples', () => {
    expect(SUPER_ADMIN_PROMPT.examples?.length).toBeGreaterThanOrEqual(2);
  });
});
