import { describe, expect, it } from 'vitest';

import { createDefaultPlusState } from '../defaults/agentPlusState';
import {
  ADMIN_DISPATCH_TOOL_IDS,
  ADMIN_LLM_FACING_TOOL_IDS,
} from '../constants/adminExclusiveTools';
import {
  applyAdminExclusiveBindings,
  canToggleAdminExclusiveTool,
  filterCatalogToolsForAgent,
} from './adminExclusiveBindings';

describe('adminExclusiveBindings', () => {
  it('forces only LLM-facing admin tools on for super_admin', () => {
    const next = applyAdminExclusiveBindings('super_admin', createDefaultPlusState());
    for (const toolId of ADMIN_LLM_FACING_TOOL_IDS) {
      expect(next.plugins[toolId]).toBe(true);
    }
    for (const toolId of ADMIN_DISPATCH_TOOL_IDS) {
      expect(next.plugins[toolId]).toBeUndefined();
    }
  });

  it('strips dispatch tools even if previously enabled on super_admin', () => {
    const base = createDefaultPlusState({
      plugins: { list_scored_news: true, platform_invoke: false },
    });
    const next = applyAdminExclusiveBindings('super_admin', base);
    expect(next.plugins.list_scored_news).toBeUndefined();
    expect(next.plugins.platform_invoke).toBe(true);
  });

  it('strips admin tools from non-super_admin agents', () => {
    const base = createDefaultPlusState({
      plugins: { list_schedules: true, web_search: true, platform_invoke: true },
    });
    const next = applyAdminExclusiveBindings('topic_copilot', base);
    expect(next.plugins.list_schedules).toBeUndefined();
    expect(next.plugins.platform_invoke).toBeUndefined();
    expect(next.plugins.web_search).toBe(true);
  });

  it('blocks toggling LLM-facing admin tools for super_admin', () => {
    expect(canToggleAdminExclusiveTool('super_admin', 'platform_invoke')).toBe(false);
    expect(canToggleAdminExclusiveTool('super_admin', 'list_schedules')).toBe(false);
    expect(canToggleAdminExclusiveTool('topic_copilot', 'list_schedules')).toBe(true);
    expect(canToggleAdminExclusiveTool('super_admin', 'web_search')).toBe(true);
  });

  it('filters dispatch tools from catalog for super_admin', () => {
    const tools = [
      { id: 'list_schedules', name: 'List schedules', description: '' },
      { id: 'platform_invoke', name: 'Platform invoke', description: '' },
      { id: 'web_search', name: 'Web search', description: '' },
    ];
    expect(filterCatalogToolsForAgent('super_admin', tools).map((t) => t.id)).toEqual([
      'platform_invoke',
      'web_search',
    ]);
    expect(filterCatalogToolsForAgent('topic_copilot', tools).map((t) => t.id)).toEqual([
      'web_search',
    ]);
  });
});
