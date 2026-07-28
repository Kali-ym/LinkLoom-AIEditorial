import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import type { DockerExecOptions, DockerExecResult, DockerExecRunner } from '../../src/services/agents/engine/DockerExecRunner.js';
import { ReadWorkspaceFileTool } from '../../src/plugins/builtin/tools/ReadWorkspaceFileTool.js';
import { WriteWorkspaceFileTool } from '../../src/plugins/builtin/tools/WriteWorkspaceFileTool.js';
import { EditWorkspaceFileTool } from '../../src/plugins/builtin/tools/EditWorkspaceFileTool.js';
import { setDefaultWorkspaceFileRunnerForTests } from '../../src/plugins/builtin/tools/workspaceFileToolSupport.js';

class FakeDockerExecRunner implements DockerExecRunner {
  lastCall?: DockerExecOptions;
  result: DockerExecResult = { stdout: '', stderr: '', exitCode: 0 };

  exec = async (options: DockerExecOptions): Promise<DockerExecResult> => {
    this.lastCall = options;
    return this.result;
  };
}

function buildSandboxContext(containerId: string) {
  return {
    workspace: {
      workspaceId: 'agent_sandbox_agent_alpha',
      mode: 'docker' as const,
      createdAt: new Date().toISOString(),
      metadata: {
        pool: 'per-agent',
        containerId,
        agentId: 'agent_alpha'
      }
    },
    workspacePolicy: {
      mode: 'docker' as const,
      pool: 'per-agent' as const,
      cleanup: 'manual' as const
    }
  };
}

describe('workspace file tools', () => {
  const runner = new FakeDockerExecRunner();

  afterEach(() => {
    setDefaultWorkspaceFileRunnerForTests(undefined);
  });

  it('read_workspace_file routes through docker exec for per-agent sandboxes', async () => {
    setDefaultWorkspaceFileRunnerForTests(runner);
    runner.result = {
      stdout: `${Buffer.from('hello').toString('base64')}\nMETA:0:5`,
      stderr: '',
      exitCode: 0
    };

    const tool = new ReadWorkspaceFileTool();
    const result = await tool.handler({ path: 'notes.txt' }, buildSandboxContext('cid_1') as never);

    expect(result.content).toBe('hello');
    expect(result.encoding).toBe('utf8');
    expect(runner.lastCall?.containerId).toBe('cid_1');
    expect(runner.lastCall?.cwd).toBe('/workspace');
    expect(runner.lastCall?.command).toContain("notes.txt");
  });

  it('write_workspace_file routes through docker exec for per-agent sandboxes', async () => {
    setDefaultWorkspaceFileRunnerForTests(runner);
    runner.result = {
      stdout: '5\n',
      stderr: '',
      exitCode: 0
    };

    const tool = new WriteWorkspaceFileTool();
    const result = await tool.handler(
      { path: 'out.txt', content: 'hello' },
      buildSandboxContext('cid_1') as never
    );

    expect(result.bytesWritten).toBe(5);
    expect(runner.lastCall?.containerId).toBe('cid_1');
    expect(runner.lastCall?.command).toContain('base64 -d');
  });

  it('read_workspace_file reads from a local workspace root', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'linkloom-ws-read-'));
    await fs.writeFile(path.join(root, 'local.txt'), 'local-data', 'utf8');

    const tool = new ReadWorkspaceFileTool();
    const result = await tool.handler(
      { path: 'local.txt' },
      {
        workspace: {
          workspaceId: 'local_ws',
          mode: 'local',
          rootDir: root,
          createdAt: new Date().toISOString()
        }
      } as never
    );

    expect(result.content).toBe('local-data');
    expect(result.encoding).toBe('utf8');
  });

  it('edit_workspace_file replaces text in a local workspace file', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'linkloom-ws-edit-'));
    await fs.writeFile(path.join(root, 'patch.txt'), 'hello world', 'utf8');

    const tool = new EditWorkspaceFileTool();
    const result = await tool.handler(
      { path: 'patch.txt', search: 'world', replace: 'LinkLoom' },
      {
        workspace: {
          workspaceId: 'local_ws',
          mode: 'local',
          rootDir: root,
          createdAt: new Date().toISOString()
        }
      } as never
    );

    expect(result.replacements).toBe(1);
    await expect(fs.readFile(path.join(root, 'patch.txt'), 'utf8')).resolves.toBe('hello LinkLoom');
  });

});
