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

export async function listWorkspaceDir(
  dirPath: string,
  recursive: boolean,
  context?: ToolExecutionContext,
  runner: DockerExecRunner = getDefaultRunner()
): Promise<{
  path: string;
  entries: Array<{ name: string; path: string; type: 'file' | 'directory'; size?: number }>;
}> {
  if (isPerAgentDockerWorkspace(context?.workspace)) {
    const containerId = String(context!.workspace!.metadata!.containerId);
    return listSandboxWorkspaceDir(runner, containerId, dirPath, recursive, context?.signal);
  }

  const workspaceRoot = context?.workspace?.mode === 'local' ? context.workspace.rootDir : undefined;
  if (!workspaceRoot) {
    throw new Error('list_dir requires an active local or sandbox workspace');
  }

  const absolutePath = resolveLocalWorkspaceAbsolutePath(workspaceRoot, dirPath || '.');
  const stat = await fs.stat(absolutePath);
  if (!stat.isDirectory()) {
    throw new Error(`Not a directory: ${dirPath || '.'}`);
  }

  const entries: Array<{ name: string; path: string; type: 'file' | 'directory'; size?: number }> = [];
  await walkLocalDir(workspaceRoot, absolutePath, recursive, entries);
  entries.sort((a, b) => a.path.localeCompare(b.path));
  return { path: dirPath || '.', entries };
}

export async function globWorkspaceFiles(
  pattern: string,
  cwd: string,
  limit: number,
  context?: ToolExecutionContext,
  runner: DockerExecRunner = getDefaultRunner()
): Promise<{ pattern: string; cwd: string; matches: string[]; truncated: boolean }> {
  const trimmedPattern = pattern.trim();
  if (!trimmedPattern) {
    throw new Error('pattern is required');
  }

  if (isPerAgentDockerWorkspace(context?.workspace)) {
    const containerId = String(context!.workspace!.metadata!.containerId);
    return globSandboxWorkspaceFiles(
      runner,
      containerId,
      trimmedPattern,
      cwd,
      limit,
      context?.signal
    );
  }

  const workspaceRoot = context?.workspace?.mode === 'local' ? context.workspace.rootDir : undefined;
  if (!workspaceRoot) {
    throw new Error('glob requires an active local or sandbox workspace');
  }

  const relativeCwd = resolveWorkspaceRelativePath(cwd || '.', SANDBOX_WORKSPACE_ROOT);
  const searchRoot = resolveLocalWorkspaceAbsolutePath(workspaceRoot, relativeCwd);
  const matches: string[] = [];
  for await (const entry of fs.glob(trimmedPattern, { cwd: searchRoot })) {
    const relFromWorkspace = path.posix.join(
      relativeCwd === '.' ? '' : relativeCwd,
      entry.split(path.sep).join('/')
    );
    matches.push(relFromWorkspace.replace(/^\//, '') || entry.split(path.sep).join('/'));
    if (matches.length >= limit) break;
  }
  return {
    pattern: trimmedPattern,
    cwd: relativeCwd,
    matches,
    truncated: matches.length >= limit,
  };
}

export async function grepWorkspaceFiles(
  pattern: string,
  options: {
    path?: string;
    glob?: string;
    caseInsensitive?: boolean;
    limit?: number;
  },
  context?: ToolExecutionContext,
  runner: DockerExecRunner = getDefaultRunner()
): Promise<{
  pattern: string;
  matches: Array<{ path: string; line: number; text: string }>;
  truncated: boolean;
}> {
  const trimmedPattern = pattern.trim();
  if (!trimmedPattern) {
    throw new Error('pattern is required');
  }
  const limit = options.limit && options.limit > 0 ? Math.floor(options.limit) : 100;
  const flags = options.caseInsensitive ? 'i' : '';
  let regex: RegExp;
  try {
    regex = new RegExp(trimmedPattern, flags);
  } catch {
    throw new Error(`Invalid regex pattern: ${trimmedPattern}`);
  }

  if (isPerAgentDockerWorkspace(context?.workspace)) {
    const containerId = String(context!.workspace!.metadata!.containerId);
    return grepSandboxWorkspaceFiles(
      runner,
      containerId,
      trimmedPattern,
      options,
      limit,
      context?.signal
    );
  }

  const workspaceRoot = context?.workspace?.mode === 'local' ? context.workspace.rootDir : undefined;
  if (!workspaceRoot) {
    throw new Error('grep requires an active local or sandbox workspace');
  }

  const searchPath = options.path?.trim() || '.';
  const absoluteBase = resolveLocalWorkspaceAbsolutePath(workspaceRoot, searchPath);
  const filePaths: string[] = [];
  const baseStat = await fs.stat(absoluteBase);
  if (baseStat.isFile()) {
    filePaths.push(absoluteBase);
  } else if (baseStat.isDirectory()) {
    const globPattern = options.glob?.trim() || '**/*';
    for await (const entry of fs.glob(globPattern, { cwd: absoluteBase })) {
      const full = path.join(absoluteBase, entry);
      try {
        const st = await fs.stat(full);
        if (st.isFile() && st.size <= DEFAULT_WORKSPACE_FILE_MAX_BYTES) {
          filePaths.push(full);
        }
      } catch {
        // skip unreadable
      }
      if (filePaths.length >= limit * 20) break;
    }
  } else {
    throw new Error(`Not a file or directory: ${searchPath}`);
  }

  const matches: Array<{ path: string; line: number; text: string }> = [];
  for (const absolute of filePaths) {
    if (matches.length >= limit) break;
    let content: string;
    try {
      const buf = await fs.readFile(absolute);
      if (!isUtf8Text(buf.subarray(0, Math.min(buf.length, 4096)))) continue;
      content = buf.toString('utf8');
    } catch {
      continue;
    }
    const rel = path.relative(workspaceRoot, absolute).split(path.sep).join('/');
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (matches.length >= limit) break;
      if (regex.test(lines[i]!)) {
        matches.push({ path: rel, line: i + 1, text: lines[i]!.slice(0, 500) });
      }
    }
  }

  return { pattern: trimmedPattern, matches, truncated: matches.length >= limit };
}

async function walkLocalDir(
  workspaceRoot: string,
  absolutePath: string,
  recursive: boolean,
  out: Array<{ name: string; path: string; type: 'file' | 'directory'; size?: number }>
): Promise<void> {
  const dirents = await fs.readdir(absolutePath, { withFileTypes: true });
  for (const dirent of dirents) {
    const absolute = path.join(absolutePath, dirent.name);
    const rel = path.relative(workspaceRoot, absolute).split(path.sep).join('/');
    if (dirent.isDirectory()) {
      out.push({ name: dirent.name, path: rel, type: 'directory' });
      if (recursive) {
        await walkLocalDir(workspaceRoot, absolute, true, out);
      }
    } else if (dirent.isFile()) {
      const st = await fs.stat(absolute);
      out.push({ name: dirent.name, path: rel, type: 'file', size: st.size });
    }
  }
}

async function listSandboxWorkspaceDir(
  runner: DockerExecRunner,
  containerId: string,
  dirPath: string,
  recursive: boolean,
  signal?: AbortSignal
): Promise<{
  path: string;
  entries: Array<{ name: string; path: string; type: 'file' | 'directory'; size?: number }>;
}> {
  const relative = resolveWorkspaceRelativePath(dirPath || '.');
  const findDepth = recursive ? '' : '-maxdepth 1';
  const command = [
    `test -d ${shellQuote(relative)} || exit 4`,
    `find ${shellQuote(relative)} ${findDepth} ! -path ${shellQuote(relative)} -printf '%y\\t%s\\t%P\\n'`,
  ].join('; ');

  const result = await runner.exec({
    containerId,
    command,
    cwd: SANDBOX_WORKSPACE_ROOT,
    signal,
  });
  if (result.exitCode === 4) {
    throw new Error(`Directory not found: ${dirPath || '.'}`);
  }
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || result.stdout || `Failed to list ${dirPath || '.'}`);
  }

  const entries = result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [typeFlag, sizeRaw, ...rest] = line.split('\t');
      const namePath = rest.join('\t');
      const posixPath =
        relative === '.' ? namePath : path.posix.join(relative, namePath);
      return {
        name: path.posix.basename(namePath),
        path: posixPath,
        type: (typeFlag === 'd' ? 'directory' : 'file') as 'file' | 'directory',
        size: typeFlag === 'f' ? Number(sizeRaw) : undefined,
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path));

  return { path: dirPath || '.', entries };
}

async function globSandboxWorkspaceFiles(
  runner: DockerExecRunner,
  containerId: string,
  pattern: string,
  cwd: string,
  limit: number,
  signal?: AbortSignal
): Promise<{ pattern: string; cwd: string; matches: string[]; truncated: boolean }> {
  const relativeCwd = resolveWorkspaceRelativePath(cwd || '.');
  const command = [
    `shopt -s globstar nullglob`,
    `cd ${shellQuote(relativeCwd)} || exit 4`,
    `printf '%s\\n' ${shellQuote(pattern)}`,
  ].join('; ');

  const result = await runner.exec({
    containerId,
    command,
    cwd: SANDBOX_WORKSPACE_ROOT,
    signal,
  });
  if (result.exitCode === 4) {
    throw new Error(`Directory not found: ${cwd || '.'}`);
  }
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || result.stdout || `Failed to glob ${pattern}`);
  }

  const matches = result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && line !== pattern)
    .map((entry) =>
      relativeCwd === '.' ? entry : path.posix.join(relativeCwd, entry)
    )
    .slice(0, limit);

  return {
    pattern,
    cwd: relativeCwd,
    matches,
    truncated: matches.length >= limit,
  };
}

async function grepSandboxWorkspaceFiles(
  runner: DockerExecRunner,
  containerId: string,
  pattern: string,
  options: { path?: string; glob?: string; caseInsensitive?: boolean },
  limit: number,
  signal?: AbortSignal
): Promise<{
  pattern: string;
  matches: Array<{ path: string; line: number; text: string }>;
  truncated: boolean;
}> {
  const searchPath = resolveWorkspaceRelativePath(options.path || '.');
  const grepFlags = options.caseInsensitive ? '-nri' : '-nr';
  const include = options.glob?.trim()
    ? `--include=${shellQuote(options.glob.trim())}`
    : '';
  const command = `grep ${grepFlags} ${include} -- ${shellQuote(pattern)} ${shellQuote(searchPath)} | head -n ${limit} || true`;

  const result = await runner.exec({
    containerId,
    command,
    cwd: SANDBOX_WORKSPACE_ROOT,
    signal,
  });
  if (result.exitCode > 1) {
    throw new Error(result.stderr || result.stdout || `Failed to grep ${pattern}`);
  }

  const matches = result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^([^:]+):(\d+):(.*)$/);
      if (!m) return null;
      return { path: m[1]!, line: Number(m[2]), text: m[3]!.slice(0, 500) };
    })
    .filter((m): m is { path: string; line: number; text: string } => Boolean(m))
    .slice(0, limit);

  return { pattern, matches, truncated: matches.length >= limit };
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
