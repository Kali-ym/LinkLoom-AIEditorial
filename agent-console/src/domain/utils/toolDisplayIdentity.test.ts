import { describe, expect, it } from 'vitest';

import type { ToolPayload } from '../types/tool';
import { filterResolvableTools, hasResolvableToolIdentity } from './toolDisplayIdentity';

describe('toolDisplayIdentity', () => {
  it('accepts mapped api tools', () => {
    const tool: ToolPayload = {
      identifier: 'linkloom-skill-store',
      apiName: 'searchSkill',
      plugin: 'linkloom-skill-store',
      state: 'executing',
    };
    expect(hasResolvableToolIdentity(tool)).toBe(true);
  });

  it('rejects identity-less placeholders', () => {
    expect(hasResolvableToolIdentity({ id: 'x', toolCallId: 'x', state: 'executing' })).toBe(false);
    expect(filterResolvableTools([
      { identifier: 'a', apiName: 'b', state: 'success' },
      { id: 'orphan', state: 'executing' },
    ])).toHaveLength(1);
  });
});
