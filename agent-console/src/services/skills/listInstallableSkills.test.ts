import { describe, expect, it } from 'vitest';

import { EMPTY_SKILL_CATALOG } from '../../adapters/emptyDomainDefaults';
import { listInstallableSkills } from './listInstallableSkills';

describe('listInstallableSkills', () => {
  it('returns catalog skills that are not enabled on the agent', () => {
    const catalog = {
      ...EMPTY_SKILL_CATALOG,
      projectSkills: [{ id: 'skill-a', name: 'Skill A', description: 'A' }],
      agentSkills: [{ id: 'skill-b', name: 'Skill B', description: 'B' }],
      userSkills: [{ id: 'skill-a', name: 'Skill A', description: 'A', source: 'user' as const }],
    };

    expect(listInstallableSkills(catalog, { 'skill-b': true })).toEqual([
      { id: 'skill-a', name: 'Skill A', description: 'A' },
    ]);
  });
});
