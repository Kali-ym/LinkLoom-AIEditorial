import { describe, expect, it } from 'vitest';
import {
  readAgentConsoleWorkspaceConfig,
  resolveWorkspacePolicyFromAgent,
  resolveWorkspacePolicyFromExecutionTarget
} from '../../src/services/agents/engine/WorkspacePolicyResolver.js';

describe('WorkspacePolicyResolver', () => {
  it('maps sandbox execution target to per-agent docker policy', () => {
    const policy = resolveWorkspacePolicyFromExecutionTarget({
      executionTarget: 'sandbox',
      sandboxPolicy: {
        image: 'linkloom-agent:latest',
        resourceLimits: { memoryMb: 1024 }
      }
    });

    expect(policy).toMatchObject({
      mode: 'docker',
      pool: 'per-agent',
      cleanup: 'manual',
      resourceLimits: { memoryMb: 1024 },
      metadata: { image: 'linkloom-agent:latest' }
    });
  });

  it('reads executionTarget from metadata.agentConsole', () => {
    const config = readAgentConsoleWorkspaceConfig({
      metadata: {
        agentConsole: {
          executionTarget: 'sandbox',
          sandboxPolicy: { idleTimeoutMs: 1_800_000 }
        }
      }
    });

    expect(config).toMatchObject({
      executionTarget: 'sandbox',
      sandboxPolicy: { idleTimeoutMs: 1_800_000 }
    });
  });

  it('resolves workspace policy from agent definition when override is absent', () => {
    const policy = resolveWorkspacePolicyFromAgent({
      metadata: {
        agentConsole: {
          executionTarget: 'local'
        }
      }
    });

    expect(policy).toMatchObject({ mode: 'local' });
  });

  it('prefers explicit run override over agent config', () => {
    const policy = resolveWorkspacePolicyFromAgent(
      {
        metadata: {
          agentConsole: { executionTarget: 'sandbox' }
        }
      },
      { mode: 'none' }
    );

    expect(policy).toEqual({ mode: 'none' });
  });
});
