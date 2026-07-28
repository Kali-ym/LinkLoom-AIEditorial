import { isValidElement } from 'react';
import { describe, expect, it } from 'vitest';

import { resolveAgentAvatar } from './agentAvatar';

describe('agentAvatar', () => {
  it('super_admin resolves to Shield icon', () => {
    const avatar = resolveAgentAvatar({ id: 'super_admin', name: '超级管理员' });
    expect(avatar).not.toBe('超');
    expect(isValidElement(avatar)).toBe(true);
  });
});
