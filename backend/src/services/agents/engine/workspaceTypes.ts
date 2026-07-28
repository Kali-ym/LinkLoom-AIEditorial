/**
 * ContainerRuntime abstraction and shared types.
 *
 * Design notes:
 * - A single agent run maps to one container; the run lifecycle is managed by
 *   WorkspaceManager which owns start/cleanup.
 * - We use eager-start semantics: start() returns a handle immediately after
 *   `docker createContainer + start`. The agent loop (PR5) will be responsible
 *   for keeping the container alive while it streams work back to the host.
 * - Errors carry a stable `ContainerRuntimeErrorCode` so WorkspaceManager can
 *   choose fallback policy deterministically.
 */

export type ContainerStatus = 'starting' | 'running' | 'exited' | 'errored';

export const CONTAINER_STATUSES: readonly ContainerStatus[] = [
  'starting',
  'running',
  'exited',
  'errored'
];

export function isContainerStatus(value: unknown): value is ContainerStatus {
  return (
    typeof value === 'string' &&
    (CONTAINER_STATUSES as readonly string[]).includes(value)
  );
}

export type ContainerRuntimeErrorCode =
  | 'daemon-unreachable'
  | 'image-missing'
  | 'permission-denied'
  | 'unsupported-mode'
  | 'start-failed'
  | 'inspect-failed'
  | 'stop-failed'
  | 'remove-failed'
  | 'sandbox-capacity-exceeded';

export const CONTAINER_RUNTIME_ERROR_CODES: readonly ContainerRuntimeErrorCode[] = [
  'daemon-unreachable',
  'image-missing',
  'permission-denied',
  'unsupported-mode',
  'start-failed',
  'inspect-failed',
  'stop-failed',
  'remove-failed',
  'sandbox-capacity-exceeded'
];

export class ContainerRuntimeError extends Error {
  readonly code: ContainerRuntimeErrorCode;
  readonly cause?: unknown;

  constructor(code: ContainerRuntimeErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'ContainerRuntimeError';
    this.code = code;
    this.cause = cause;
  }
}

export type ContainerNetworkMode = 'disabled' | 'bridge' | 'host';

export interface ContainerMountSpec {
  source: string;
  target: string;
  readonly?: boolean;
}

export interface ContainerResourceLimits {
  cpuCores?: number;
  memoryMb?: number;
  timeoutMs?: number;
}

export interface ContainerRunSpec {
  image: string;
  workspaceId: string;
  runId?: string;
  mounts: ContainerMountSpec[];
  env: Record<string, string>;
  resourceLimits?: ContainerResourceLimits;
  network?: ContainerNetworkMode;
  user?: string;
  readonlyRootfs?: boolean;
  capDrop?: string[];
  securityOpt?: string[];
  command: string[];
  workingDir?: string;
  labels?: Record<string, string>;
}

export interface NormalizedContainerRunSpec {
  image: string;
  workspaceId: string;
  runId?: string;
  mounts: ContainerMountSpec[];
  env: Record<string, string>;
  resourceLimits: ContainerResourceLimits;
  network: ContainerNetworkMode;
  user: string;
  readonlyRootfs: boolean;
  capDrop: string[];
  securityOpt: string[];
  command: string[];
  workingDir: string;
  labels: Record<string, string>;
}

export function normalizeContainerRunSpec(
  spec: ContainerRunSpec
): NormalizedContainerRunSpec {
  return {
    image: spec.image,
    workspaceId: spec.workspaceId,
    runId: spec.runId,
    mounts: spec.mounts.map((m) => ({ ...m })),
    env: { ...spec.env },
    resourceLimits: { ...(spec.resourceLimits ?? {}) },
    network: spec.network ?? 'disabled',
    user: spec.user ?? 'agent:1000',
    readonlyRootfs: spec.readonlyRootfs ?? true,
    capDrop: spec.capDrop ?? ['ALL'],
    securityOpt: spec.securityOpt ?? ['no-new-privileges:true'],
    command: [...spec.command],
    workingDir: spec.workingDir ?? '/workspace',
    labels: {
      'linkloom.workspaceId': spec.workspaceId,
      ...(spec.runId ? { 'linkloom.runId': spec.runId } : {}),
      ...(spec.labels ?? {})
    }
  };
}

export interface ContainerInspectResult {
  status: ContainerStatus;
  exitCode?: number;
  error?: string;
}

export interface ContainerHandle {
  containerId: string;
  status: ContainerStatus;
  startedAt: string;
  workspaceId: string;
  inspect(): Promise<ContainerInspectResult>;
  stop(timeoutMs?: number): Promise<void>;
  remove(): Promise<void>;
}

export interface ContainerAvailability {
  ok: boolean;
  reason?: string;
  version?: string;
}

export interface ContainerListFilter {
  workspaceId?: string;
  status?: ContainerStatus[];
  labels?: Record<string, string>;
}

export interface ContainerRuntime {
  /** Probe the runtime for reachability + permission; never throws. */
  isAvailable(): Promise<ContainerAvailability>;
  /** Start a container for one agent run; returns a handle for later control. */
  start(spec: ContainerRunSpec): Promise<ContainerHandle>;
  /** Start a previously-created container (warm pool resume). */
  startExisting(containerId: string): Promise<ContainerHandle>;
  /** List containers visible to the runtime. */
  list(filter?: ContainerListFilter): Promise<ContainerHandle[]>;
  /** Get a handle for a previously-started container; undefined if unknown. */
  get(containerId: string): ContainerHandle | undefined;
  /** Release any long-lived resources (sockets, etc.). */
  shutdown(): Promise<void>;
}
