import { describe, expect, it } from 'vitest';

import { hasInterventionMeta } from '../interventionMeta';
import {
  BUILTIN_INTERVENTION_APIS,
  listBuiltinInterventionMeta,
} from './registryMeta';

describe('builtin intervention registry meta (P1 #6)', () => {
  it('covers all builtin toolsets in the high-confidence subset', () => {
    const identifiers = new Set(listBuiltinInterventionMeta().map((entry) => entry.identifier));
    expect(identifiers).toEqual(
      new Set([
        'linkloom-agent-builder',
        'claude-code',
        'linkloom-admin',
        'linkloom-cloud-sandbox',
        'linkloom-group-management',
        'linkloom-agent',
        'linkloom-local-system',
        'linkloom-user-memory',
        'linkloom-user-interaction',
        'linkloom-web-onboarding',
      ]),
    );
  });

  it('registers 58 apiName keys', () => {
    expect(listBuiltinInterventionMeta()).toHaveLength(63);
  });

  it('maps createPlan separately from createTodos', () => {
    expect(BUILTIN_INTERVENTION_APIS['linkloom-agent']).toContain('createPlan');
    expect(BUILTIN_INTERVENTION_APIS['linkloom-agent']).toContain('createTodos');
  });

  it('registers showAgentMarketplace for custom interaction routing', () => {
    expect(BUILTIN_INTERVENTION_APIS['linkloom-web-onboarding']).toContain('showAgentMarketplace');
  });

  it('does not register executeCode on linkloom-local-system', () => {
    expect(BUILTIN_INTERVENTION_APIS['linkloom-local-system']).not.toContain('executeCode');
  });

  it('registry apiNames all have intervention meta', () => {
    const registryApis = new Set(listBuiltinInterventionMeta().map((entry) => entry.apiName));
    const missing = [...registryApis].filter((apiName) => !hasInterventionMeta(apiName));
    expect(missing).toEqual([]);
  });

  it('registry keys match meta-covered builtin apis', () => {
    const registryKeys = new Set(listBuiltinInterventionMeta().map((entry) => entry.apiName));
    const metaKeys = new Set(
      listBuiltinInterventionMeta()
        .map((entry) => entry.apiName)
        .filter((apiName) => hasInterventionMeta(apiName)),
    );
    expect(metaKeys).toEqual(registryKeys);
  });
});
