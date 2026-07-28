import { execSync } from 'child_process';
import { describe, expect, it } from 'vitest';
import { AgentSandboxPool } from '../../src/services/agents/engine/AgentSandboxPool.js';
import { WorkspaceManager } from '../../src/services/agents/engine/WorkspaceManager.js';
import { DockerContainerRuntime } from '../../src/services/agents/engine/ContainerRuntime.js';
import type { AgentRunSpec } from '../../src/services/agents/engine/AgentRunSpec.js';
import { ExecuteCommandTool } from '../../src/plugins/builtin/tools/ExecuteCommandTool.js';
import { InMemoryAgentSandboxInstanceStore } from '../../src/services/repositories/AgentSandboxInstanceRepository.js';

function hasDocker(): boolean {
  try {
    execSync('docker version --format "{{.Server.Version}}"', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function imageExists(name: string): boolean {
  try {
    execSync(`docker image inspect ${name}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

describe.skipIf(!hasDocker() || !imageExists('linkloom-agent:demo'))(
  'ExecuteCommandTool sandbox integration',
  () => {
    it('runs echo hello inside a per-agent warm sandbox container', async () => {
      const previousImage = process.env.LINKLOOM_AGENT_IMAGE;
      process.env.LINKLOOM_AGENT_IMAGE = 'linkloom-agent:demo';
      try {
        const runtime = new DockerContainerRuntime();
        const store = new InMemoryAgentSandboxInstanceStore();
        const pool = new AgentSandboxPool({
          runtime,
          store,
          workspaceRootDir: `/tmp/linkloom-exec-integration-${Date.now()}`
        });
        const mgr = new WorkspaceManager({ runtime, sandboxPool: pool });
        const spec = {
          runId: 'run_exec_int_1',
          sessionId: 'sess_exec_int_1',
          threadId: 'sess_exec_int_1',
          source: 'agent',
          input: { messages: [] },
          metadata: {},
          agentDef: { id: `agent_exec_${Date.now()}` },
          workspacePolicy: {
            mode: 'docker',
            pool: 'per-agent',
            cleanup: 'manual',
            network: 'disabled',
            writes: 'workspace-only'
          }
        } as unknown as AgentRunSpec;

        const created = await mgr.createWorkspace(spec);
        if (created.workspace?.mode === 'local') {
          throw new Error(`Integration fell back to local: ${JSON.stringify(created.workspace.metadata)}`);
        }

        const tool = new ExecuteCommandTool();
        const result = await tool.handler(
          { command: 'echo hello' },
          {
            workspace: created.workspace,
            workspacePolicy: spec.workspacePolicy
          } as any
        );

        expect(result.exitCode).toBe(0);
        expect(result.stdout.trim()).toBe('hello');
      } finally {
        if (previousImage === undefined) {
          delete process.env.LINKLOOM_AGENT_IMAGE;
        } else {
          process.env.LINKLOOM_AGENT_IMAGE = previousImage;
        }
      }
    }, 60_000);
  }
);
