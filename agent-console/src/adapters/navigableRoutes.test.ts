import { describe, expect, it } from 'vitest';

import { getNavigableRoutes } from './navigableRoutes';

const ADMIN_ROUTE_IDS = [
  'scheduling',
  'selection',
  'generation',
  'ops',
  'history',
  'agents',
  'settings',
] as const;

describe('getNavigableRoutes', () => {
  it('includes all 7 admin internal route ids', () => {
    const ids = getNavigableRoutes().map((route) => route.id);
    for (const id of ADMIN_ROUTE_IDS) {
      expect(ids).toContain(id);
    }
  });

  it('scheduling path is /scheduling', () => {
    const scheduling = getNavigableRoutes().find((route) => route.id === 'scheduling');
    expect(scheduling?.path).toBe('/scheduling');
  });
});
