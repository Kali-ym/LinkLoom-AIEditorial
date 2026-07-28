import Docker from 'dockerode';
import {
  ContainerRuntimeError,
  type ContainerAvailability,
  type ContainerHandle,
  type ContainerInspectResult,
  type ContainerRuntime,
  type ContainerRunSpec,
  type ContainerStatus,
  type NormalizedContainerRunSpec,
  normalizeContainerRunSpec
} from './workspaceTypes.js';
import type { ContainerListFilter } from './workspaceTypes.js';

type DockerContainerLike = {
  id: string;
  start: () => Promise<void>;
  stop: (opts?: { t?: number }) => Promise<void>;
  remove: (opts?: { force?: boolean; v?: boolean }) => Promise<void>;
  inspect: () => Promise<{
    State?: { Status?: string; ExitCode?: number; Error?: string };
    Config?: { Labels?: Record<string, string> };
  }>;
};

function isNodeErrorCode(error: unknown, code: string): boolean {
  return (
    !!error &&
    typeof error === 'object' &&
    (error as { code?: unknown }).code === code
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function getHttpStatus(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'statusCode' in error) {
    const value = (error as { statusCode?: unknown }).statusCode;
    if (typeof value === 'number') return value;
  }
  return undefined;
}

function mapDockerStateToStatus(state: string | undefined): ContainerStatus {
  switch (state) {
    case 'running':
      return 'running';
    case 'created':
    case 'restarting':
      return 'starting';
    case 'exited':
    case 'dead':
    case 'removing':
    case 'removed':
      return 'exited';
    default:
      return 'errored';
  }
}

export class DockerContainerRuntime implements ContainerRuntime {
  private readonly docker: Docker;
  private readonly handlesByContainerId = new Map<string, DockerContainerLike>();

  constructor(opts?: { socketPath?: string; docker?: Docker }) {
    this.docker =
      opts?.docker ??
      new Docker(opts?.socketPath ? { socketPath: opts.socketPath } : undefined);
  }

  async isAvailable(): Promise<ContainerAvailability> {
    try {
      const version = await this.docker.ping();
      return {
        ok: true,
        version: typeof version === 'object' ? 'unknown' : String(version ?? 'ok')
      };
    } catch (error) {
      if (isNodeErrorCode(error, 'ECONNREFUSED') || isNodeErrorCode(error, 'ENOENT')) {
        return { ok: false, reason: 'daemon-unreachable' };
      }
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, reason: message };
    }
  }

  async start(spec: ContainerRunSpec): Promise<ContainerHandle> {
    const normalized = normalizeContainerRunSpec(spec);
    let created: DockerContainerLike;
    try {
      created = await this.docker.createContainer(this.toCreateOptions(normalized));
    } catch (error) {
      if (getHttpStatus(error) === 404) {
        throw new ContainerRuntimeError(
          'image-missing',
          `Docker image not found: ${normalized.image}`,
          error
        );
      }
      if (getHttpStatus(error) === 403) {
        throw new ContainerRuntimeError('permission-denied', 'Docker permission denied', error);
      }
      throw new ContainerRuntimeError(
        'start-failed',
        `Failed to create container: ${getErrorMessage(error)}`,
        error
      );
    }
    try {
      await created.start();
    } catch (error) {
      if (getHttpStatus(error) === 404) {
        throw new ContainerRuntimeError(
          'image-missing',
          `Docker image not found: ${normalized.image}`,
          error
        );
      }
      if (getHttpStatus(error) === 403) {
        throw new ContainerRuntimeError('permission-denied', 'Docker permission denied', error);
      }
      throw new ContainerRuntimeError(
        'start-failed',
        `Failed to start container: ${getErrorMessage(error)}`,
        error
      );
    }
    this.handlesByContainerId.set(created.id, created);
    return this.toHandle(created, normalized.workspaceId);
  }

  async startExisting(containerId: string): Promise<ContainerHandle> {
    const container = this.docker.getContainer(containerId) as DockerContainerLike;
    try {
      await container.start();
    } catch (error) {
      if (getHttpStatus(error) === 304) {
        // already running
      } else if (getHttpStatus(error) === 404) {
        throw new ContainerRuntimeError(
          'start-failed',
          `Container not found: ${containerId}`,
          error
        );
      } else if (getHttpStatus(error) === 403) {
        throw new ContainerRuntimeError('permission-denied', 'Docker permission denied', error);
      } else {
        throw new ContainerRuntimeError(
          'start-failed',
          `Failed to start container: ${getErrorMessage(error)}`,
          error
        );
      }
    }
    this.handlesByContainerId.set(containerId, container);
    let workspaceId = '';
    try {
      const data = await container.inspect();
      workspaceId = data.Config?.Labels?.['linkloom.workspaceId'] ?? '';
    } catch {
      // inspect optional for handle creation
    }
    return this.toHandle(container, workspaceId, 'running');
  }

  async list(filter?: ContainerListFilter): Promise<ContainerHandle[]> {
    let dockerList: Awaited<ReturnType<typeof this.docker.listContainers>>;
    try {
      dockerList = await this.docker.listContainers({ all: true });
    } catch {
      // Docker daemon unreachable (e.g. /var/run/docker.sock missing inside containers).
      // Return empty list so callers (findHandle, refreshStatus, resumeExisting) degrade
      // gracefully instead of propagating a raw ENOENT/ECONNREFUSED as HTTP 500.
      return [];
    }
    const handles: ContainerHandle[] = [];
    for (const info of dockerList) {
      const labels = info.Labels ?? {};
      if (filter?.workspaceId && labels['linkloom.workspaceId'] !== filter.workspaceId) continue;
      if (filter?.labels) {
        const matches = Object.entries(filter.labels).every(([key, value]) => labels[key] === value);
        if (!matches) continue;
      }
      const status = mapDockerStateToStatus(info.State);
      if (filter?.status && !filter.status.includes(status)) continue;
      const container = this.docker.getContainer(info.Id);
      handles.push(
        this.toHandle(
          container,
          labels['linkloom.workspaceId'] ?? '',
          status
        )
      );
    }
    return handles;
  }

  get(containerId: string): ContainerHandle | undefined {
    const raw = this.handlesByContainerId.get(containerId);
    if (!raw) return undefined;
    return this.toHandle(raw, '', 'running');
  }

  async shutdown(): Promise<void> {
    this.handlesByContainerId.clear();
  }

  private toHandle(
    container: DockerContainerLike,
    workspaceId: string,
    initial: ContainerStatus = 'starting'
  ): ContainerHandle {
    const startedAt = new Date().toISOString();
    return {
      containerId: container.id,
      status: initial,
      startedAt,
      workspaceId,
      inspect: async (): Promise<ContainerInspectResult> => {
        try {
          const data = await container.inspect();
          const state = data.State?.Status;
          return {
            status: mapDockerStateToStatus(state),
            exitCode: data.State?.ExitCode,
            error: data.State?.Error
          };
        } catch (error) {
          throw new ContainerRuntimeError(
            'inspect-failed',
            `Inspect failed: ${getErrorMessage(error)}`,
            error
          );
        }
      },
      stop: async (timeoutMs?: number): Promise<void> => {
        try {
          await container.stop({
            t: Math.max(0, Math.floor((timeoutMs ?? 10_000) / 1000))
          });
        } catch (error) {
          if (getHttpStatus(error) === 304) return;
          throw new ContainerRuntimeError(
            'stop-failed',
            `Stop failed: ${getErrorMessage(error)}`,
            error
          );
        }
      },
      remove: async (): Promise<void> => {
        try {
          await container.remove({ force: false, v: true });
        } catch (error) {
          if (getHttpStatus(error) === 404) return;
          throw new ContainerRuntimeError(
            'remove-failed',
            `Remove failed: ${getErrorMessage(error)}`,
            error
          );
        }
      }
    };
  }

  private toCreateOptions(spec: NormalizedContainerRunSpec) {
    return {
      Image: spec.image,
      Env: Object.entries(spec.env).map(([k, v]) => `${k}=${v}`),
      Cmd: spec.command,
      WorkingDir: spec.workingDir,
      User: spec.user,
      Labels: spec.labels,
      HostConfig: {
        Binds: spec.mounts.map(
          (m) => `${m.source}:${m.target}${m.readonly ? ':ro' : ':rw'}`
        ),
        NetworkMode:
          spec.network === 'disabled'
            ? 'none'
            : spec.network === 'host'
              ? 'host'
              : 'bridge',
        ReadonlyRootfs: spec.readonlyRootfs,
        CapDrop: spec.capDrop,
        SecurityOpt: spec.securityOpt,
        ...(spec.resourceLimits.memoryMb
          ? { Memory: Math.floor(spec.resourceLimits.memoryMb * 1024 * 1024) }
          : {}),
        ...(spec.resourceLimits.cpuCores
          ? { NanoCpus: Math.floor(spec.resourceLimits.cpuCores * 1e9) }
          : {}),
        AutoRemove: false
      }
    };
  }
}

export function createDefaultContainerRuntime(): ContainerRuntime {
  return new DockerContainerRuntime();
}

export { CONTAINER_STATUSES } from './workspaceTypes.js';
