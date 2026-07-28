import { describe, expect, it } from 'vitest';

import { createDefaultPlusState } from '../defaults/agentPlusState';
import { ADMIN_EXCLUSIVE_TOOL_IDS } from '../constants/adminExclusiveTools';
import {
  applyAdminExclusiveBindings,
  canToggleAdminExclusiveTool,
  filterCatalogToolsForAgent,
} from './adminExclusiveBindings';

describe('adminExclusiveBindings', () => {
  it('forces all admin tools on for super_admin', () => {
    const next = applyAdminExclusiveBindings('super_admin', createDefaultPlusState());
    for (const toolId of ADMIN_EXCLUSIVE_TOOL_IDS) {
      expect(next.plugins[toolId]).toBe(true);
    }
  });

  it('strips admin tools from non-super_admin agents', () => {
    const base = createDefaultPlusState({
      plugins: { list_schedules: true, web_search: true },
    });
    const next = applyAdminExclusiveBindings('topic_copilot', base);
    expect(next.plugins.list_schedules).toBeUndefined();
    expect(next.plugins.web_search).toBe(true);
  });

  it('blocks toggling admin tools for super_admin', () => {
    expect(canToggleAdminExclusiveTool('super_admin', 'list_schedules')).toBe(false);
    expect(canToggleAdminExclusiveTool('topic_copilot', 'list_schedules')).toBe(true);
    expect(canToggleAdminExclusiveTool('super_admin', 'web_search')).toBe(true);
  });

  it('filters admin tools from catalog for non-super_admin', () => {
    const tools = [
      { id: 'list_schedules', name: 'List schedules', description: '' },
      { id: 'web_search', name: 'Web search', description: '' },
    ];
    expect(filterCatalogToolsForAgent('topic_copilot', tools).map((t) => t.id)).toEqual([
      'web_search',
    ]);
    expect(filterCatalogToolsForAgent('super_admin', tools)).toHaveLength(2);
  });
});
