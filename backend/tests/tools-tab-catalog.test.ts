import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { initRegistries } from '../src/registries/PluginInit.js';
import { ToolRegistry } from '../src/registries/ToolRegistry.js';
import {
  ADMIN_EXCLUSIVE_TOOL_ID_SET,
  getPublicToolCategories,
} from '../../admin/src/domain/consoleCatalog.js';

describe('public tool catalog coverage', () => {
  beforeAll(async () => {
    await initRegistries();
  });

  afterAll(() => {
    // @ts-expect-error test-only reset
    ToolRegistry['instance'] = undefined;
  });

  it('has no uncategorized non-system public tools', () => {
    const tools = ToolRegistry.getInstance()
      .getAllTools()
      .filter((tool) => tool.scope !== 'system');
    const publicTools = tools.filter((tool) => !ADMIN_EXCLUSIVE_TOOL_ID_SET.has(tool.id));
    const categorizedIds = new Set(getPublicToolCategories().flatMap((cat) => cat.toolIds));
    const uncategorized = publicTools.filter((tool) => !categorizedIds.has(tool.id));

    expect(uncategorized.map((tool) => tool.id)).toEqual([]);
  });
});
