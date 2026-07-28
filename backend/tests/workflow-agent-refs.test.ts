import { describe, expect, it } from 'vitest';
import { findWorkflowsReferencingAgent } from '../src/utils/workflowAgentRefs.js';

const workflows = [
  {
    id: 'wf_a',
    name: '日报 A',
    steps: [
      { id: 'coverage', type: 'tool' as const, toolId: 'query_coverage_index' },
      { id: 'brief', type: 'agent' as const, agentId: 'ai_daily_brief' }
    ]
  },
  {
    id: 'wf_b',
    name: '日报 B',
    steps: [
      { id: 'plan', type: 'agent' as const, agentId: 'ai_daily_plan' },
      { id: 'qa', type: 'agent' as const, agentId: 'ai_daily_brief' }
    ]
  }
];

describe('findWorkflowsReferencingAgent', () => {
  it('returns matching workflows with step ids', () => {
    const refs = findWorkflowsReferencingAgent('ai_daily_brief', workflows);
    expect(refs).toHaveLength(2);
    expect(refs[0]).toEqual({ id: 'wf_a', name: '日报 A', stepIds: ['brief'] });
    expect(refs[1]).toEqual({ id: 'wf_b', name: '日报 B', stepIds: ['qa'] });
  });

  it('returns empty array when agent is not referenced', () => {
    expect(findWorkflowsReferencingAgent('unused', workflows)).toHaveLength(0);
  });
});
