import { mkdtemp, mkdir, rm, utimes, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AgentWorkspaceFileService } from '../../src/services/api/AgentWorkspaceFileService.js';
import type { AgentDefinition } from '../../src/types/agent.js';

function sandboxAgent(executionTarget: 'sandbox' | 'local' = 'sandbox'): AgentDefinition {
  return {
    id: 'agent_test',
    name: 'Test Agent',
    metadata: { agentConsole: { executionTarget } },
  };
}

describe('AgentWorkspaceFileService', () => {
  let tmpRoot: string;
  let workspaceRoot: string;
  let service: AgentWorkspaceFileService;

  beforeEach(async () => {
    tmpRoot = await mkdtemp(path.join(os.tmpdir(), 'll-ws-files-'));
    workspaceRoot = path.join(tmpRoot, 'agents', 'agent_test');
    await mkdir(workspaceRoot, { recursive: true });
    service = new AgentWorkspaceFileService({
      dataDir: tmpRoot,
      getAgent: async (id) => (id === 'agent_test' ? sandboxAgent() : null),
      getSandboxHostMount: async () => workspaceRoot,
    });
  });

  afterEach(async () => {
    await rm(tmpRoot, { recursive: true, force: true });
  });

  it('rejects path traversal on readContent', async () => {
    await expect(service.readContent('agent_test', '../etc/passwd')).rejects.toMatchObject({
      statusCode: 400,
      code: 'path_invalid',
    });
  });

  it('returns 403 when executionTarget is not configured', async () => {
    const noTargetService = new AgentWorkspaceFileService({
      dataDir: tmpRoot,
      getAgent: async () => ({
        ...sandboxAgent(),
        metadata: { agentConsole: {} },
      }),
      getSandboxHostMount: async () => workspaceRoot,
    });
    await expect(noTargetService.listTree('agent_test')).rejects.toMatchObject({
      statusCode: 403,
      code: 'workspace_not_configured',
    });
  });

  it('allows executionTarget=local to list tree via dataDir fallback', async () => {
    const localService = new AgentWorkspaceFileService({
      dataDir: tmpRoot,
      getAgent: async () => sandboxAgent('local'),
      getSandboxHostMount: async () => null,
    });
    // workspaceRoot (tmpRoot/agents/agent_test) already created in beforeEach;
    // local mode resolves root to agentSandboxHostMount(dataDir, agentId) = same path.
    const tree = await localService.listTree('agent_test');
    expect(Array.isArray(tree)).toBe(true);
  });

  it('lists nested tree', async () => {
    await mkdir(path.join(workspaceRoot, 'notes'), { recursive: true });
    await writeFile(path.join(workspaceRoot, 'notes', 'a.md'), '# hi');
    const tree = await service.listTree('agent_test');
    expect(tree).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'notes',
          type: 'directory',
          children: expect.arrayContaining([
            expect.objectContaining({ path: 'notes/a.md', type: 'file', name: 'a.md' }),
          ]),
        }),
      ])
    );
  });

  it('createFile and readContent roundtrip', async () => {
    await service.createFile('agent_test', 'docs/new.md', '# hello\n');
    const result = await service.readContent('agent_test', 'docs/new.md');
    expect(result).toMatchObject({
      path: 'docs/new.md',
      content: '# hello\n',
      size: Buffer.byteLength('# hello\n', 'utf8'),
    });
    expect(typeof result.updatedAt).toBe('number');
  });

  it('moveEntry renames file', async () => {
    await service.createFile('agent_test', 'old.txt', 'content');
    const moved = await service.moveEntry('agent_test', 'old.txt', 'renamed.txt');
    expect(moved).toEqual({ from: 'old.txt', to: 'renamed.txt' });
    await expect(service.readContent('agent_test', 'old.txt')).rejects.toMatchObject({
      statusCode: 404,
      code: 'path_not_found',
    });
    const result = await service.readContent('agent_test', 'renamed.txt');
    expect(result.content).toBe('content');
  });

  it('deleteEntry removes file', async () => {
    await service.createFile('agent_test', 'to-delete.txt', 'bye');
    const deleted = await service.deleteEntry('agent_test', 'to-delete.txt');
    expect(deleted).toEqual({ path: 'to-delete.txt' });
    await expect(service.readContent('agent_test', 'to-delete.txt')).rejects.toMatchObject({
      statusCode: 404,
      code: 'path_not_found',
    });
  });

  it('deleteEntry removes directory recursively', async () => {
    await service.mkdir('agent_test', 'folder');
    await service.createFile('agent_test', 'folder/child.txt', 'x');
    const deleted = await service.deleteEntry('agent_test', 'folder');
    expect(deleted).toEqual({ path: 'folder' });
    await expect(service.readContent('agent_test', 'folder/child.txt')).rejects.toMatchObject({
      statusCode: 404,
      code: 'path_not_found',
    });
  });

  it('writeContent rejects stale expectedUpdatedAt', async () => {
    await service.createFile('agent_test', 'stale.md', 'v1\n');
    const { updatedAt } = await service.readContent('agent_test', 'stale.md');
    const abs = path.join(workspaceRoot, 'stale.md');
    const staleMtime = new Date(updatedAt - 60_000);
    await writeFile(abs, 'v2\n');
    await utimes(abs, staleMtime, staleMtime);
    await expect(
      service.writeContent('agent_test', 'stale.md', 'v3\n', updatedAt),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'content_conflict',
    });
  });
});
