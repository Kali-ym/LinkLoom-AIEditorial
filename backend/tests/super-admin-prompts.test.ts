import { describe, expect, it } from 'vitest';
import {
  SUPER_ADMIN_AGENT_ID,
  SUPER_ADMIN_PROMPT,
} from '../src/services/editorial/superAdminPrompts.js';
import {
  ADMIN_TOOLS,
  ADMIN_TOOL_IDS,
  ADMIN_PLATFORM_TOOLS,
  ADMIN_SOP_TOOL_IDS,
  ADMIN_DISPATCH_TOOL_IDS,
} from '../src/plugins/builtin/tools/admin/index.js';

const ALLOWED_PLAYBOOK_TOOLS = new Set([
  'platform_invoke',
  'platform_discover',
  'create_cron',
  'trigger_scoring',
  'update_news_score',
  'run_workflow',
  'generate_daily_report',
  'publish_report',
  'decide_workflow_step',
  'rebuild_hot_snapshot',
  'query_knowledge',
  'query_memory',
]);

describe('SUPER_ADMIN_PROMPT', () => {
  it('has correct agent id constant', () => {
    expect(SUPER_ADMIN_AGENT_ID).toBe('super_admin');
  });

  it('role mentions super admin', () => {
    expect(SUPER_ADMIN_PROMPT.role).toContain('超级管理员');
  });

  it('registers platform tools plus legacy handlers', () => {
    expect(ADMIN_PLATFORM_TOOLS.map((t) => t.id)).toEqual([
      'platform_discover',
      'platform_invoke',
    ]);
    expect(ADMIN_TOOLS.length).toBeGreaterThanOrEqual(70);
    expect(ADMIN_TOOL_IDS).toEqual(
      expect.arrayContaining(['platform_discover', 'platform_invoke', ...ADMIN_SOP_TOOL_IDS]),
    );
    expect(ADMIN_TOOL_IDS).toHaveLength(ADMIN_PLATFORM_TOOLS.length + ADMIN_SOP_TOOL_IDS.length);
    expect(ADMIN_DISPATCH_TOOL_IDS.length).toBeGreaterThanOrEqual(63);
    expect(ADMIN_DISPATCH_TOOL_IDS).toEqual(
      expect.arrayContaining([
        'list_raw_news',
        'import_opml',
        'delete_workflow',
        'list_agent_runs',
        'rag_reindex',
      ]),
    );
    expect(ADMIN_DISPATCH_TOOL_IDS).not.toEqual(expect.arrayContaining([...ADMIN_SOP_TOOL_IDS]));
  });

  it('capabilities mentions platform_invoke and SOP tools', () => {
    expect(SUPER_ADMIN_PROMPT.capabilities).toContain('platform_invoke');
    expect(SUPER_ADMIN_PROMPT.capabilities).toContain('create_cron');
    expect(SUPER_ADMIN_PROMPT.capabilities).toContain('query_knowledge');
    expect(SUPER_ADMIN_PROMPT.capabilities).toContain('query_memory');
  });

  it('taskPlaybook covers core SOP and platform flows', () => {
    const tasks = SUPER_ADMIN_PROMPT.taskPlaybook!.map((e) => e.task);
    expect(tasks).toContain('create_cron');
    expect(tasks).toContain('trigger_scoring');
    expect(tasks).toContain('generate_daily_report');
    expect(tasks).toContain('save_agent');
    expect(tasks).toContain('delete_agent');
    expect(tasks).toContain('update_settings');
    expect(tasks).toContain('create_kb_category');
    expect(tasks).toContain('batch_reset_scoring');
    expect(tasks).toContain('create_api_key');
    expect(tasks).toContain('list_agents');
    expect(tasks).toContain('query_knowledge');
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

  it('every playbook tool is platform or SOP/editorial', () => {
    for (const entry of SUPER_ADMIN_PROMPT.taskPlaybook!) {
      expect(ALLOWED_PLAYBOOK_TOOLS.has(String(entry.tool))).toBe(true);
    }
  });

  it('high-risk tasks mark 高危 in confirm', () => {
    const high = SUPER_ADMIN_PROMPT.taskPlaybook!.filter((e) =>
      [
        'delete_cron',
        'delete_news',
        'publish_report',
        'clear_adapter_data',
        'delete_agent',
        'update_settings',
        'batch_reset_scoring',
      ].includes(String(e.task)),
    );
    for (const entry of high) expect(entry.confirm).toContain('高危');
  });

  it('has at least 2 examples', () => {
    expect(SUPER_ADMIN_PROMPT.examples?.length).toBeGreaterThanOrEqual(2);
  });
});
