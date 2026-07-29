import { describe, expect, it } from 'vitest';

import type { SkillCatalog } from './types/skill';
import { buildAgentBindingRows } from '../features/ChatInput/ActionBar/Plus/agentBindingCatalog';
import { ADMIN_DISPATCH_TOOL_IDS } from './constants/adminExclusiveTools';

const CATALOG_WITH_ADMIN: SkillCatalog = {
  commands: [],
  agentSkills: [],
  projectSkills: [],
  userSkills: [],
  tools: [
    { id: 'web_search', name: 'web_search', description: 'Search' },
    { id: 'list_schedules', name: 'list_schedules', description: 'List schedules' },
    { id: 'create_cron', name: 'create_cron', description: 'Create cron' },
    { id: 'platform_invoke', name: 'platform_invoke', description: 'Platform invoke' },
  ],
  agents: [],
};

describe('buildAgentBindingRows admin exclusivity', () => {
  it('hides admin tools for non-super_admin agents', () => {
    const rows = buildAgentBindingRows(CATALOG_WITH_ADMIN, {}, 'topic_copilot');
    const toolIds = rows.filter((row) => row.kind === 'tool').map((row) => row.id);
    expect(toolIds).toEqual(['web_search']);
  });

  it('hides dispatch CRUD and forces LLM-facing tools for super_admin', () => {
    const rows = buildAgentBindingRows(CATALOG_WITH_ADMIN, {}, 'super_admin');
    const toolIds = rows.filter((row) => row.kind === 'tool').map((row) => row.id);
    expect(toolIds).toContain('web_search');
    expect(toolIds).toContain('create_cron');
    expect(toolIds).toContain('platform_invoke');
    expect(toolIds).not.toContain('list_schedules');
    for (const dispatchId of ADMIN_DISPATCH_TOOL_IDS) {
      expect(toolIds).not.toContain(dispatchId);
    }
    const forced = rows.filter((row) => row.forcedEnabled).map((row) => row.id).sort();
    expect(forced).toEqual(['create_cron', 'platform_invoke']);
  });
});
