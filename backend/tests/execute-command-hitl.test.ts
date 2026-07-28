import { describe, expect, it } from 'vitest';

import { ExecuteCommandTool } from '../src/plugins/builtin/tools/ExecuteCommandTool.js';
import {
  createPlatformPermissionPolicy,
  previewPermissionEffect,
} from '../src/services/agents/engine/PermissionEngine.js';

describe('execute_command HITL', () => {
  it('requires human approval via platform permission policy', () => {
    const result = previewPermissionEffect(createPlatformPermissionPolicy(), {
      toolName: 'execute_command',
    });

    expect(result.decision.effect).toBe('ask');
    expect(result.request.subject.actionKind).toBe('execute_command');
  });

  it('executes after approval without a second in-tool gate', async () => {
    const tool = new ExecuteCommandTool();
    const result = await tool.handler({ command: 'echo approved-output' });

    expect(result).toMatchObject({
      command: 'echo approved-output',
      stdout: 'approved-output\n',
      output: 'approved-output\n',
      exitCode: 0,
    });
  });
});
