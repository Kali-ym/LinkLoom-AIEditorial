import { describe, expect, it } from 'vitest';

import { TOOL_CATEGORIES } from './types/skill';
import {
  ADMIN_EXCLUSIVE_TOOL_ID_SET,
  filterPublicCatalogTools,
  getPublicToolCategories,
} from './constants/adminExclusiveTools';

/** Mirrors AgentsPage visibleToolCatalog + ToolsTab uncategorized logic. */
function findUncategorizedPublicToolIds(allToolIds: string[]): string[] {
  const catalog = filterPublicCatalogTools(allToolIds.map((id) => ({ id })));
  const categorizedIds = new Set(getPublicToolCategories().flatMap((c) => c.toolIds));
  return catalog.filter((t) => !categorizedIds.has(t.id)).map((t) => t.id);
}

describe('ToolsTab uncategorized tools', () => {
  it('every non-admin registered tool id is categorized', () => {
    const allIds = [
      ...new Set(TOOL_CATEGORIES.flatMap((c) => c.toolIds)),
    ];
    const uncategorized = findUncategorizedPublicToolIds(allIds);
    expect(uncategorized).toEqual([]);
  });

  it('drops blank tool ids from public catalog', () => {
    const filtered = filterPublicCatalogTools([
      { id: 'web_search' },
      { id: '' },
      { id: '   ' },
      { id: 'list_schedules' },
    ]);
    expect(filtered.map((t) => t.id)).toEqual(['web_search']);
  });

  it('admin tool ids are not counted as uncategorized when still in full list', () => {
    const allIds = [...ADMIN_EXCLUSIVE_TOOL_ID_SET];
    const uncategorized = findUncategorizedPublicToolIds(allIds);
    expect(uncategorized).toEqual([]);
  });
});
