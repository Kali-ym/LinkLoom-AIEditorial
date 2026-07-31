import { describe, expect, it } from 'vitest';
import {
  CONTAINER_RUNTIME_ERROR_CODES,
  ContainerRuntimeError,
  isContainerStatus,
  normalizeContainerRunSpec
} from '../../src/services/agents/engine/workspaceTypes.js';

describe('workspaceTypes', () => {
  it('exposes the known error codes', () => {
    expect(CONTAINER_RUNTIME_ERROR_CODES).toEqual([
      'daemon-unreachable',
      'image-missing',
      'permission-denied',
      'unsupported-mode',
      'start-failed',
      'inspect-failed',
      'stop-failed',
      'remove-failed',
      'sandbox-capacity-exceeded'
    ]);
  });

  it('recognizes container statuses', () => {
    for (const s of ['starting', 'running', 'exited', 'errored']) {
      expect(isContainerStatus(s)).toBe(true);
    }
    expect(isContainerStatus('paused')).toBe(false);
  });

  it('normalizes a ContainerRunSpec with safe defaults', () => {
    const spec = normalizeContainerRunSpec({
      image: 'linkloom-agent:latest',
      workspaceId: 'ws_x',
      mounts: [],
      env: {},
      command: ['node', '/app/agent-runner.js']
    });
    expect(spec.user).toBe('agent:1000');
    expect(spec.network).toBe('disabled');
    expect(spec.readonlyRootfs).toBe(true);
    expect(spec.capDrop).toEqual(['ALL']);
    expect(spec.securityOpt).toEqual(['no-new-privileges:true']);
    expect(spec.labels['linkloom.workspaceId']).toBe('ws_x');
  });

  it('ContainerRuntimeError carries a known code', () => {
    const err = new ContainerRuntimeError('start-failed', 'cannot start');
    expect(err.code).toBe('start-failed');
    expect(err.message).toBe('cannot start');
  });
});
