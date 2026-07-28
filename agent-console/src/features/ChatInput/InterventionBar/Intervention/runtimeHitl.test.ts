import { describe, expect, it } from 'vitest';

import { defaultAllowedActionsForKind, isRuntimeHitlKind } from './runtimeHitl';

describe('runtimeHitl', () => {
  it('detects runtime HITL kinds', () => {
    expect(isRuntimeHitlKind('needs_input')).toBe(true);
    expect(isRuntimeHitlKind('permission')).toBe(false);
  });

  it('returns default actions for needs_input', () => {
    expect(defaultAllowedActionsForKind('needs_input')).toEqual(['provide_input', 'cancel']);
  });
});
