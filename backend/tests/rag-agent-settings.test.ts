import { describe, expect, it } from 'vitest';
import {
  resolveRagPlannerAgentId,
  resolveRagSynthesisAgentId
} from '../src/services/rag/RagSettings.js';

describe('RAG agent settings', () => {
  it('resolves synthesis agent id from rag config', () => {
    expect(resolveRagSynthesisAgentId({ synthesisAgentId: ' kb_agent ' } as any)).toBe('kb_agent');
    expect(resolveRagSynthesisAgentId({ synthesisAgentId: '' } as any)).toBe('');
  });

  it('falls back planner agent id to synthesis agent id', () => {
    expect(
      resolveRagPlannerAgentId({
        synthesisAgentId: 'summary_agent',
        plannerAgentId: ''
      } as any)
    ).toBe('summary_agent');
    expect(
      resolveRagPlannerAgentId({
        synthesisAgentId: 'summary_agent',
        plannerAgentId: 'planner_agent'
      } as any)
    ).toBe('planner_agent');
  });
});
