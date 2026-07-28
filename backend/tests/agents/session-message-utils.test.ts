import { describe, expect, it } from 'vitest';
import {
  buildConsoleMessageId,
  parseConsoleMessageId,
} from '../../src/services/agents/sessionMessageUtils.js';

describe('sessionMessageUtils', () => {
  it('parses thread user and assistant ids', () => {
    expect(parseConsoleMessageId('run-1:thread:user:0')).toEqual({
      runId: 'run-1',
      kind: 'user',
      userIndex: 0,
    });
    expect(parseConsoleMessageId('run-1:thread:assistant')).toEqual({
      runId: 'run-1',
      kind: 'assistant',
    });
  });

  it('builds stable console message ids', () => {
    expect(buildConsoleMessageId('run-1', 'assistant', 0)).toBe('run-1:thread:assistant');
    expect(buildConsoleMessageId('run-1', 'user', 2)).toBe('run-1:thread:user:2');
  });
});
