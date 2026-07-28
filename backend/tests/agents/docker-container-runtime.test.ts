import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const pingMock = vi.fn();
const createContainerMock = vi.fn();
const getContainerMock = vi.fn();
const listContainersMock = vi.fn();

vi.mock('dockerode', () => {
  return {
    default: class Docker {
      ping = pingMock;
      createContainer = createContainerMock;
      getContainer = getContainerMock;
      listContainers = listContainersMock;
    }
  };
});

const { DockerContainerRuntime } = await import(
  '../../src/services/agents/engine/ContainerRuntime.js'
);

const baseSpec = {
  image: 'linkloom-agent:latest',
  workspaceId: 'ws_1',
  runId: 'run_1',
  mounts: [{ source: '/data/host/ws_1', target: '/workspace', readonly: false }],
  env: { FOO: 'bar' },
  command: ['node', '/app/agent-runner.js']
};

describe('DockerContainerRuntime', () => {
  beforeEach(() => {
    pingMock.mockReset();
    createContainerMock.mockReset();
    getContainerMock.mockReset();
    listContainersMock.mockReset();
  });

  afterEach(async () => {
    // best-effort; nothing to dispose beyond the test instance
  });

  it('isAvailable returns ok when docker ping succeeds', async () => {
    pingMock.mockResolvedValueOnce({});
    const rt = new DockerContainerRuntime();
    const r = await rt.isAvailable();
    expect(r.ok).toBe(true);
    await rt.shutdown();
  });

  it('isAvailable returns daemon-unreachable when ping fails with ECONNREFUSED', async () => {
    pingMock.mockRejectedValueOnce({ code: 'ECONNREFUSED', message: 'connect ECONNREFUSED' });
    const rt = new DockerContainerRuntime();
    const r = await rt.isAvailable();
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('daemon-unreachable');
    await rt.shutdown();
  });

  it('start throws ContainerRuntimeError(image-missing) when container start returns 404', async () => {
    pingMock.mockResolvedValue({});
    createContainerMock.mockImplementation(() => ({
      id: 'cid_404',
      start: vi.fn().mockRejectedValueOnce({ statusCode: 404, message: 'No such image' })
    }));
    const rt = new DockerContainerRuntime();
    await expect(rt.start(baseSpec)).rejects.toMatchObject({
      name: 'ContainerRuntimeError',
      code: 'image-missing'
    });
    await rt.shutdown();
  });

  it('start returns a handle when container start succeeds', async () => {
    pingMock.mockResolvedValue({});
    const start = vi.fn().mockResolvedValueOnce(undefined);
    createContainerMock.mockImplementation(() => ({ id: 'cid_1', start }));
    const rt = new DockerContainerRuntime();
    const handle = await rt.start(baseSpec);
    expect(handle.containerId).toBe('cid_1');
    expect(handle.status).toBe('starting');
    expect(handle.workspaceId).toBe('ws_1');
    await rt.shutdown();
  });
});
