import { describe, expect, it } from 'vitest';
import { evaluateRouterStep } from '../src/services/agents/steps/RouterStep.js';
import { evalCondition } from '../src/services/agents/workflowExpressions.js';

describe('RouterStep', () => {
  it('evalCondition supports path/op/value', () => {
    const scope = { score: 0.2, hasNewProgress: true };
    expect(evalCondition({ path: '$.score', op: 'gte', value: 0.5 }, scope)).toBe(false);
    expect(evalCondition({ path: '$.hasNewProgress', op: 'truthy' }, scope)).toBe(true);
  });

  it('selects first matching branch', () => {
    const output = evaluateRouterStep(
      { score: 0.9 },
      {
        branches: [
          {
            id: 'skip',
            condition: { path: '$.score', op: 'lt', value: 0.3 },
            nextStepIds: ['sink_skip']
          },
          {
            id: 'run',
            condition: { path: '$.score', op: 'gte', value: 0.5 },
            nextStepIds: ['plan']
          }
        ],
        defaultNextStepIds: ['fallback']
      },
      { score: 0.9, input: { score: 0.9 }, current: { score: 0.9 } }
    );

    expect(output.selectedBranch).toBe('run');
    expect(output.selectedNextStepIds).toEqual(['plan']);
  });

  it('falls back to defaultNextStepIds', () => {
    const output = evaluateRouterStep(
      { score: 0.1 },
      {
        branches: [
          {
            id: 'run',
            condition: { path: '$.score', op: 'gte', value: 0.5 },
            nextStepIds: ['plan']
          }
        ],
        defaultNextStepIds: ['skipped']
      },
      { score: 0.1, input: { score: 0.1 }, current: { score: 0.1 } }
    );

    expect(output.selectedBranch).toBe('default');
    expect(output.selectedNextStepIds).toEqual(['skipped']);
  });
});
