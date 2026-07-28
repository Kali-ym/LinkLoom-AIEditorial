import { describe, expect, it } from 'vitest';

import type { ToolPayload } from '../../../domain/types/tool';
import { getWorkflowCompletionStatus } from './toolDisplayNames';

describe('getWorkflowCompletionStatus', () => {
  it('treats in-flight and unknown states as working', () => {
    expect(getWorkflowCompletionStatus([{ state: 'executing' } as ToolPayload])).toBe('working');
    expect(getWorkflowCompletionStatus([{ state: 'pending' } as ToolPayload])).toBe('working');
    expect(getWorkflowCompletionStatus([{} as ToolPayload])).toBe('working');
  });

  it('returns error only after every tool has a terminal state', () => {
    const tools: ToolPayload[] = [
      { state: 'success' } as ToolPayload,
      { state: 'error' } as ToolPayload,
    ];
    expect(getWorkflowCompletionStatus(tools)).toBe('error');
  });

  it('returns success when all tools finished successfully', () => {
    const tools: ToolPayload[] = [
      { state: 'success' } as ToolPayload,
      { state: 'success' } as ToolPayload,
    ];
    expect(getWorkflowCompletionStatus(tools)).toBe('success');
  });
});
