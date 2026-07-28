import { describe, expect, it } from 'vitest';

import {
  isPermissionPauseToolError,
  looksLikePermissionId,
  matchesToolReference,
  primaryToolPatchKey,
} from './toolReference';
import type { ToolPayload } from '../types/tool';

describe('toolReference', () => {
  const tool: ToolPayload = {
    id: 'call_wsM0',
    toolCallId: 'call_wsM0',
    permissionId: 'perm-exec-1',
    state: 'executing',
  };

  it('matches by toolCallId or permissionId', () => {
    expect(matchesToolReference(tool, 'call_wsM0')).toBe(true);
    expect(matchesToolReference(tool, 'perm-exec-1')).toBe(true);
    expect(matchesToolReference(tool, 'other')).toBe(false);
  });

  it('prefers toolCallId for patch key', () => {
    expect(primaryToolPatchKey(tool)).toBe('call_wsM0');
  });

  it('detects permission pause errors', () => {
    expect(
      isPermissionPauseToolError({
        state: 'error',
        error: "Permission required for tool 'execute_command'",
      }),
    ).toBe(true);
    expect(isPermissionPauseToolError({ state: 'success' })).toBe(false);
  });

  it('detects permission ids', () => {
    expect(looksLikePermissionId('perm_run_abc')).toBe(true);
    expect(looksLikePermissionId('call_wsM0')).toBe(false);
  });
});
