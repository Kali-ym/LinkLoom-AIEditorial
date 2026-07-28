import { describe, expect, it } from 'vitest';

import type { SkillCatalog } from '../domain/types/skill';
import { buildSlashCatalogItems } from './slashActionItems';

const catalog: SkillCatalog = {
  commands: [],
  agentSkills: [
    { id: 'daily-one-x', name: 'Daily One X', description: '' },
    { id: 'memory-read', name: 'Memory Read', description: '' },
  ],
  projectSkills: [],
  userSkills: [],
  tools: [],
  agents: [],
};

describe('buildSlashCatalogItems', () => {
  it('shows only enabled agent skills when enabledPlugins is provided', () => {
    const items = buildSlashCatalogItems(
      catalog,
      { isAtLineStart: true, isMidLineAfterWhitespace: false },
      {
        activeTopicId: 'topic-1',
        projectSkillsEnabled: false,
        enabledPlugins: { 'daily-one-x': true, 'memory-read': false },
      },
    );

    expect(items.map((item) => item.type)).toEqual(['daily-one-x']);
  });
});
