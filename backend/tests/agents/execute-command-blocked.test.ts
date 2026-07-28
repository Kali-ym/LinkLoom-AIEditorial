import { describe, expect, it } from 'vitest';

import { ExecuteCommandTool } from '../../src/plugins/builtin/tools/ExecuteCommandTool.js';

function buildSandboxContext(containerId: string) {
  return {
    workspace: {
      workspaceId: 'agent_sandbox_agent_alpha',
      mode: 'docker' as const,
      createdAt: new Date().toISOString(),
      metadata: {
        pool: 'per-agent',
        containerId,
        agentId: 'agent_alpha',
      },
    },
    workspacePolicy: {
      mode: 'docker' as const,
      pool: 'per-agent' as const,
      cleanup: 'manual' as const,
    },
  };
}

describe('ExecuteCommandTool command blocking', () => {
  it('blocks rm -rf on local workspace execution', async () => {
    const tool = new ExecuteCommandTool();
    await expect(
      tool.handler({ command: 'rm -rf /workspace/artifacts' })
    ).rejects.toThrow(/blocked for safety/i);
  });

  it('allows rm -rf inside per-agent sandbox workspaces', async () => {
    const runner = {
      exec: async () => ({ stdout: '', stderr: '', exitCode: 0 }),
    };
    const tool = new ExecuteCommandTool({ dockerExecRunner: runner });
    const result = await tool.handler(
      { command: 'rm -rf /workspace/artifacts /workspace/prime.sh' },
      buildSandboxContext('cid_1') as never
    );

    expect(result.exitCode).toBe(0);
  });
});
