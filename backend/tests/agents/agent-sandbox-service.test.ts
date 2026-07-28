import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../src/domain/errors.js';
import { ContainerRuntimeError } from '../../src/services/agents/engine/workspaceTypes.js';
import { AgentSandboxService } from '../../src/services/agents/sandbox/AgentSandboxService.js';
import type { AgentSandboxInstance } from '../../src/services/agents/engine/AgentSandboxTypes.js';

const warmStart = vi.fn();
const refreshStatus = vi.fn();
const stop = vi.fn();
const destroy = vi.fn();
const getStatus = vi.fn();

vi.mock('../../src/services/agents/sandbox/AgentSandboxRuntime.js', () => ({
  createAgentSandboxRuntime: () => ({
    pool: { warmStart, refreshStatus, stop, destroy, getStatus },
    store: {},
    workspaceManager: {}
  })
}));

describe('AgentSandboxService', () => {
  let service: AgentSandboxService;

  beforeEach(() => {
    warmStart.mockReset();
    refreshStatus.mockReset();
    stop.mockReset();
    destroy.mockReset();
    getStatus.mockReset();
    service = new AgentSandboxService({
      getAgent: vi.fn(async (id: string) => ({
        id,
        metadata: { agentConsole: { executionTarget: 'sandbox' } }
      }))
    } as any);
  });

  it('returns not_provisioned when no sandbox exists', async () => {
    refreshStatus.mockResolvedValue(null);
    await expect(service.getSandbox('agent-1')).resolves.toEqual({
      agentId: 'agent-1',
      status: 'not_provisioned'
    });
  });

  it('warm-starts sandbox for sandbox-configured agents', async () => {
    const instance: AgentSandboxInstance = {
      agentId: 'agent-1',
      containerId: 'cid_1',
      workspaceId: 'agent_sandbox_agent-1',
      hostMountPath: '/tmp/agent-1',
      status: 'running',
      image: 'linkloom-agent:latest',
      lastUsedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    warmStart.mockResolvedValue(instance);

    await expect(service.warmStart('agent-1')).resolves.toMatchObject({
      agentId: 'agent-1',
      status: 'running',
      containerId: 'cid_1'
    });
  });

  it('maps sandbox capacity errors to HTTP 503', async () => {
    warmStart.mockRejectedValue(
      new ContainerRuntimeError(
        'sandbox-capacity-exceeded',
        'Sandbox container limit reached (1/1).'
      )
    );

    await expect(service.warmStart('agent-1')).rejects.toEqual(
      expect.objectContaining<Partial<AppError>>({
        statusCode: 503,
        code: 'sandbox-capacity-exceeded'
      })
    );
  });

  it('stops an existing sandbox', async () => {
    getStatus.mockResolvedValueOnce({
      agentId: 'agent-1',
      containerId: 'cid_1',
      workspaceId: 'agent_sandbox_agent-1',
      hostMountPath: '/tmp/agent-1',
      status: 'running',
      image: 'linkloom-agent:latest',
      lastUsedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    });
    getStatus.mockResolvedValueOnce({
      agentId: 'agent-1',
      containerId: 'cid_1',
      workspaceId: 'agent_sandbox_agent-1',
      hostMountPath: '/tmp/agent-1',
      status: 'stopped',
      image: 'linkloom-agent:latest',
      lastUsedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    });

    await expect(service.stopSandbox('agent-1')).resolves.toMatchObject({
      agentId: 'agent-1',
      status: 'stopped'
    });
    expect(stop).toHaveBeenCalledWith('agent-1');
  });
});
