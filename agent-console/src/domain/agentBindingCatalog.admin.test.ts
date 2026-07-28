import { describe, expect, it } from 'vitest';

import type { SkillCatalog } from './types/skill';
import { buildAgentBindingRows } from '../features/ChatInput/ActionBar/Plus/agentBindingCatalog';
import { ADMIN_EXCLUSIVE_TOOL_IDS } from './constants/adminExclusiveTools';

const CATALOG_WITH_ADMIN: SkillCatalog = {
  commands: [],
  agentSkills: [],
  projectSkills: [],
  userSkills: [],
  tools: [
    { id: 'web_search', name: 'web_search', description: 'Search' },
    { id: 'list_schedules', name: 'list_schedules', description: 'List schedules' },
    { id: 'create_cron', name: 'create_cron', description: 'Create cron' },
  ],
  agents: [],
};

describe('buildAgentBindingRows admin exclusivity', () => {
  it('hides admin tools for non-super_admin agents', () => {
    const rows = buildAgentBindingRows(CATALOG_WITH_ADMIN, {}, 'topic_copilot');
    const toolIds = rows.filter((row) => row.kind === 'tool').map((row) => row.id);
    expect(toolIds).toEqual(['web_search']);
    for (const adminToolId of ADMIN_EXCLUSIVE_TOOL_IDS) {
      expect(toolIds).not.toContain(adminToolId);
    }
  });

  it('shows admin tools as forced for super_admin', () => {
    const rows = buildAgentBindingRows(CATALOG_WITH_ADMIN, {}, 'super_admin');
    const adminRows = rows.filter((row) => row.adminExclusive);
    expect(adminRows.map((row) => row.id).sort()).toEqual(['create_cron', 'list_schedules']);
    expect(adminRows.every((row) => row.forcedEnabled)).toBe(true);
  });
});
