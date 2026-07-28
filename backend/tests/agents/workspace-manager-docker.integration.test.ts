import { execSync } from 'child_process';
import { describe, expect, it } from 'vitest';
import { DockerContainerRuntime } from '../../src/services/agents/engine/ContainerRuntime.js';
import { WorkspaceManager } from '../../src/services/agents/engine/WorkspaceManager.js';
import type { AgentRunSpec } from '../../src/services/agents/engine/AgentRunSpec.js';

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
  'WorkspaceManager docker integration',
  () => {
    it('creates a real docker container and inspects it', async () => {
      const previousImage = process.env.LINKLOOM_AGENT_IMAGE;
      process.env.LINKLOOM_AGENT_IMAGE = 'linkloom-agent:demo';
      try {
        const mgr = new WorkspaceManager({ runtime: new DockerContainerRuntime() });
        const spec = {
          runId: 'run_int_1',
          sessionId: 'sess_int_1',
          threadId: 'sess_int_1',
          source: 'agent',
          input: { messages: [] },
          metadata: {},
          workspacePolicy: {
            mode: 'docker',
            mounts: [],
            network: 'disabled',
            writes: 'workspace-only',
            cleanup: 'always'
          }
        } as unknown as AgentRunSpec;
        const r = await mgr.createWorkspace(spec);
        if (r.workspace?.mode === 'local') {
          // Surface the fallback reason to make integration failures actionable.
          throw new Error(
            `Integration test fell back to local: ${JSON.stringify(r.workspace?.metadata)}`
          );
        }
        expect(r.workspace?.mode).toBe('docker');
        const containerId = String(r.workspace?.metadata?.containerId);
        expect(containerId).toMatch(/^[\w]+$/);
        const handle = mgr['runtime'].get(containerId);
        expect(handle).toBeDefined();
        await mgr.cleanupWorkspace(r.workspace);
      } finally {
        if (previousImage === undefined) {
          delete process.env.LINKLOOM_AGENT_IMAGE;
        } else {
          process.env.LINKLOOM_AGENT_IMAGE = previousImage;
        }
      }
    }, 30_000);
  }
);
