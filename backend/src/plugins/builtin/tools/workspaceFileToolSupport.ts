import fs from 'fs/promises';
import path from 'path';
import { isPerAgentDockerWorkspace } from '../../../services/agents/engine/AgentSandboxTypes.js';
import {
  createDefaultDockerExecRunner,
  type DockerExecRunner
} from '../../../services/agents/engine/DockerExecRunner.js';
import type { ToolExecutionContext } from '../../../services/ToolExecutionContext.js';

export const DEFAULT_WORKSPACE_FILE_MAX_BYTES = 512 * 1024;
export const DEFAULT_WORKSPACE_FILE_EDIT_MAX_BYTES = DEFAULT_WORKSPACE_FILE_MAX_BYTES * 4;
const SANDBOX_WORKSPACE_ROOT = '/workspace';

let defaultRunner: DockerExecRunner | undefined;

export function resolveWorkspaceRelativePath(
  inputPath: string,
  workspaceRoot = SANDBOX_WORKSPACE_ROOT
): string {
  const trimmed = inputPath.trim();
  if (!trimmed) {
    throw new Error('path is required');
  }
  const normalized = trimmed.startsWith('/')
    ? path.posix.normalize(trimmed)
    : path.posix.normalize(path.posix.join(workspaceRoot, trimmed));
  const relative = path.posix.relative(workspaceRoot, normalized);
  if (relative.startsWith('..') || path.posix.isAbsolute(relative)) {
    throw new Error(`path must stay inside workspace: ${inputPath}`);
  }
  return relative || '.';
}

export function resolveLocalWorkspaceAbsolutePath(
  workspaceRoot: string,
  inputPath: string
): string {
  const relative = resolveWorkspaceRelativePath(inputPath, SANDBOX_WORKSPACE_ROOT);
  const resolved = path.resolve(workspaceRoot, relative);
  const rel = path.relative(workspaceRoot, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`path must stay inside workspace: ${inputPath}`);
  }
  return resolved;
}

export async function readWorkspaceFile(
  filePath: string,
  maxBytes: number,
  context?: ToolExecutionContext,
  runner: DockerExecRunner = getDefaultRunner()
): Promise<{
  path: string;
  encoding: 'utf8' | 'base64';
  size: number;
  truncated: boolean;
  content: string;
}> {
  if (isPerAgentDockerWorkspace(context?.workspace)) {
    const containerId = String(context!.workspace!.metadata!.containerId);
    return readSandboxWorkspaceFile(runner, containerId, filePath, maxBytes, context?.signal);
  }

  const workspaceRoot = context?.workspace?.mode === 'local' ? context.workspace.rootDir : undefined;
  if (!workspaceRoot) {
    throw new Error('read_workspace_file requires an active local or sandbox workspace');
  }

  const absolutePath = resolveLocalWorkspaceAbsolutePath(workspaceRoot, filePath);
  const stat = await fs.stat(absolutePath);
  if (!stat.isFile()) {
    throw new Error(`Not a file: ${filePath}`);
  }
  const truncated = stat.size > maxBytes;
  const buffer = await fs.readFile(absolutePath);
  const slice = buffer.subarray(0, maxBytes);
  const encoding = isUtf8Text(slice) ? 'utf8' : 'base64';
  return {
    path: filePath,
    encoding,
    size: stat.size,
    truncated,
    content: encoding === 'utf8' ? slice.toString('utf8') : slice.toString('base64'),
  };
}

export async function editWorkspaceFile(
  filePath: string,
  search: string,
  replace: string,
  replaceAll: boolean,
  context?: ToolExecutionContext,
  runner: DockerExecRunner = getDefaultRunner()
): Promise<{ path: string; replacements: number; bytesWritten: number }> {
  const readResult = await readWorkspaceFile(
    filePath,
    DEFAULT_WORKSPACE_FILE_EDIT_MAX_BYTES,
    context,
    runner
  );
  if (readResult.encoding !== 'utf8') {
    throw new Error('edit_workspace_file only supports UTF-8 text files');
  }
  if (readResult.truncated) {
    throw new Error(`File exceeds maximum editable size (${DEFAULT_WORKSPACE_FILE_EDIT_MAX_BYTES} bytes)`);
  }

  const content = readResult.content;
  if (!content.includes(search)) {
    throw new Error(`Search text not found in ${filePath}`);
  }

  let replacements = 0;
  let updated: string;
  if (replaceAll) {
    const parts = content.split(search);
    replacements = parts.length - 1;
    updated = parts.join(replace);
  } else {
    const index = content.indexOf(search);
    updated = content.slice(0, index) + replace + content.slice(index + search.length);
    replacements = 1;
  }

  const writeResult = await writeWorkspaceFile(filePath, updated, context, runner);
  return {
    path: filePath,
    replacements,
    bytesWritten: writeResult.bytesWritten,
  };
}

export async function writeWorkspaceFile(
  filePath: string,
  content: string,
  context?: ToolExecutionContext,
  runner: DockerExecRunner = getDefaultRunner()
): Promise<{ path: string; bytesWritten: number }> {
  if (isPerAgentDockerWorkspace(context?.workspace)) {
    const containerId = String(context!.workspace!.metadata!.containerId);
    return writeSandboxWorkspaceFile(runner, containerId, filePath, content, context?.signal);
  }

  const workspaceRoot = context?.workspace?.mode === 'local' ? context.workspace.rootDir : undefined;
  if (!workspaceRoot) {
    throw new Error('write_workspace_file requires an active local or sandbox workspace');
  }

  const absolutePath = resolveLocalWorkspaceAbsolutePath(workspaceRoot, filePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, content, 'utf8');
  return { path: filePath, bytesWritten: Buffer.byteLength(content, 'utf8') };
}

export function setDefaultWorkspaceFileRunnerForTests(runner: DockerExecRunner | undefined): void {
  defaultRunner = runner;
}

function getDefaultRunner(): DockerExecRunner {
  if (!defaultRunner) defaultRunner = createDefaultDockerExecRunner();
  return defaultRunner;
}

async function readSandboxWorkspaceFile(
  runner: DockerExecRunner,
  containerId: string,
  filePath: string,
  maxBytes: number,
  signal?: AbortSignal
): Promise<{
  path: string;
  encoding: 'utf8' | 'base64';
  size: number;
  truncated: boolean;
  content: string;
}> {
  const relative = resolveWorkspaceRelativePath(filePath);
  const shellPath = shellQuote(relative);
  const command = [
    `test -f ${shellPath} || exit 4`,
    `size=$(wc -c < ${shellPath})`,
    `trunc=0`,
    `if [ "$size" -gt ${maxBytes} ]; then trunc=1; fi`,
    `head -c ${maxBytes} ${shellPath} | base64 | tr -d '\\n'`,
    `echo`,
    `echo "META:$trunc:$size"`,
  ].join('; ');

  const result = await runner.exec({
    containerId,
    command,
    cwd: SANDBOX_WORKSPACE_ROOT,
    signal,
  });

  if (result.exitCode === 4) {
    throw new Error(`File not found: ${filePath}`);
  }
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || result.stdout || `Failed to read ${filePath}`);
  }

  const lines = result.stdout.trimEnd().split('\n');
  const marker = lines.pop() ?? '';
  const b64 = lines.join('').replace(/\s/g, '');
  const [, truncFlag, sizeRaw] = marker.match(/^META:(\d+):(\d+)$/) ?? [];
  const size = Number(sizeRaw);
  const truncated = truncFlag === '1';
  const buffer = Buffer.from(b64, 'base64');
  const encoding = isUtf8Text(buffer) ? 'utf8' : 'base64';

  return {
    path: filePath,
    encoding,
    size: Number.isFinite(size) ? size : buffer.length,
    truncated,
    content: encoding === 'utf8' ? buffer.toString('utf8') : b64,
  };
}

async function writeSandboxWorkspaceFile(
  runner: DockerExecRunner,
  containerId: string,
  filePath: string,
  content: string,
  signal?: AbortSignal
): Promise<{ path: string; bytesWritten: number }> {
  const relative = resolveWorkspaceRelativePath(filePath);
  const dir = path.posix.dirname(relative);
  const b64 = Buffer.from(content, 'utf8').toString('base64');
  const command = [
    `mkdir -p ${shellQuote(dir === '.' ? '.' : dir)}`,
    `printf '%s' ${shellQuote(b64)} | base64 -d > ${shellQuote(relative)}`,
    `wc -c < ${shellQuote(relative)}`,
  ].join(' && ');

  const result = await runner.exec({
    containerId,
    command,
    cwd: SANDBOX_WORKSPACE_ROOT,
    signal,
  });

  if (result.exitCode !== 0) {
    throw new Error(result.stderr || result.stdout || `Failed to write ${filePath}`);
  }

  const bytesWritten = Number(result.stdout.trim().split('\n').pop());
  return {
    path: filePath,
    bytesWritten: Number.isFinite(bytesWritten) ? bytesWritten : Buffer.byteLength(content, 'utf8'),
  };
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function isUtf8Text(buffer: Buffer): boolean {
  if (buffer.includes(0)) return false;
  const decoded = buffer.toString('utf8');
  return Buffer.from(decoded, 'utf8').equals(buffer);
}
