import fs from 'fs/promises';
import path from 'path';
import { AppError } from '../../domain/errors.js';
import { resolveWorkspaceRelativePath } from '../../plugins/builtin/tools/workspaceFileToolSupport.js';
import type { AgentDefinition } from '../../types/agent.js';
import { agentSandboxHostMount } from '../agents/engine/AgentSandboxTypes.js';
import { readAgentConsoleWorkspaceConfig } from '../agents/engine/WorkspacePolicyResolver.js';

export interface WorkspaceTreeNode {
  path: string;
  name: string;
  type: 'file' | 'directory';
  size?: number;
  updatedAt?: number;
  children?: WorkspaceTreeNode[];
}

export interface AgentWorkspaceFileServiceDeps {
  dataDir: string;
  getAgent: (id: string) => Promise<AgentDefinition | null | undefined>;
  getSandboxHostMount?: (agentId: string) => Promise<string | null>;
}

const SKIP_DIRS = new Set(['.git', 'node_modules']);
const DEFAULT_NEW_FILE_CONTENT = '# 新文档\n';

export class AgentWorkspaceFileService {
  constructor(private readonly deps: AgentWorkspaceFileServiceDeps) {}

  async listTree(agentId: string): Promise<WorkspaceTreeNode[]> {
    const root = await this.resolveRoot(agentId);
    return this.buildTree(root, root);
  }

  async readContent(
    agentId: string,
    inputPath: string
  ): Promise<{ path: string; content: string; size: number; updatedAt: number }> {
    const root = await this.resolveRoot(agentId);
    const relative = this.resolveRelativePath(inputPath);
    const abs = path.join(root, relative);
    const stat = await fs.stat(abs).catch(() => {
      throw new AppError(404, 'path_not_found', 'path_not_found');
    });
    if (!stat.isFile()) {
      throw new AppError(400, 'path_invalid', 'path_invalid');
    }
    const content = await fs.readFile(abs, 'utf8');
    return { path: relative, content, size: stat.size, updatedAt: stat.mtimeMs };
  }

  async writeContent(
    agentId: string,
    inputPath: string,
    content: string,
    expectedUpdatedAt?: number
  ): Promise<{ path: string; bytesWritten: number; updatedAt: number }> {
    const root = await this.resolveRoot(agentId);
    const relative = this.resolveRelativePath(inputPath);
    const abs = path.join(root, relative);

    const existing = await fs.stat(abs).catch(() => null);
    if (existing?.isFile() && expectedUpdatedAt !== undefined) {
      if (existing.mtimeMs !== expectedUpdatedAt) {
        throw new AppError(409, 'File changed on disk', 'content_conflict');
      }
    }

    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content, 'utf8');
    const bytesWritten = Buffer.byteLength(content, 'utf8');
    const after = await fs.stat(abs);
    return { path: relative, bytesWritten, updatedAt: after.mtimeMs };
  }

  async mkdir(agentId: string, inputPath: string): Promise<{ path: string }> {
    const root = await this.resolveRoot(agentId);
    const relative = this.resolveRelativePath(inputPath);
    const abs = path.join(root, relative);
    try {
      await fs.access(abs);
      throw new AppError(409, 'path_exists', 'path_exists');
    } catch (error) {
      if (error instanceof AppError) throw error;
    }
    await fs.mkdir(abs, { recursive: false });
    return { path: relative };
  }

  async createFile(
    agentId: string,
    inputPath: string,
    content: string = DEFAULT_NEW_FILE_CONTENT
  ): Promise<{ path: string }> {
    const root = await this.resolveRoot(agentId);
    const relative = this.resolveRelativePath(inputPath);
    const abs = path.join(root, relative);
    try {
      await fs.access(abs);
      throw new AppError(409, 'path_exists', 'path_exists');
    } catch (error) {
      if (error instanceof AppError) throw error;
    }
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content, 'utf8');
    return { path: relative };
  }

  async moveEntry(
    agentId: string,
    fromPath: string,
    toPath: string
  ): Promise<{ from: string; to: string }> {
    const root = await this.resolveRoot(agentId);
    const fromRelative = this.resolveRelativePath(fromPath);
    const toRelative = this.resolveRelativePath(toPath);
    const fromAbs = path.join(root, fromRelative);
    const toAbs = path.join(root, toRelative);

    try {
      await fs.access(fromAbs);
    } catch {
      throw new AppError(404, 'path_not_found', 'path_not_found');
    }

    try {
      await fs.access(toAbs);
      throw new AppError(409, 'path_exists', 'path_exists');
    } catch (error) {
      if (error instanceof AppError) throw error;
    }

    await fs.mkdir(path.dirname(toAbs), { recursive: true });
    await fs.rename(fromAbs, toAbs);
    return { from: fromRelative, to: toRelative };
  }

  async deleteEntry(agentId: string, inputPath: string): Promise<{ path: string }> {
    const root = await this.resolveRoot(agentId);
    const relative = this.resolveRelativePath(inputPath);
    const abs = path.join(root, relative);
    const stat = await fs.stat(abs).catch(() => {
      throw new AppError(404, 'path_not_found', 'path_not_found');
    });

    if (stat.isDirectory()) {
      await fs.rm(abs, { recursive: true, force: true });
    } else {
      await fs.unlink(abs);
    }

    return { path: relative };
  }

  private async requireSandboxAgent(agentId: string): Promise<AgentDefinition> {
    const agent = await this.deps.getAgent(agentId);
    if (!agent) {
      throw new AppError(404, 'Agent not found');
    }
    const config = readAgentConsoleWorkspaceConfig(agent);
    if (config?.executionTarget !== 'sandbox' && config?.executionTarget !== 'local') {
      throw new AppError(403, 'workspace_not_configured', 'workspace_not_configured');
    }
    return agent;
  }

  private async resolveRoot(agentId: string): Promise<string> {
    const agent = await this.requireSandboxAgent(agentId);
    const isLocal = readAgentConsoleWorkspaceConfig(agent)?.executionTarget === 'local';
    // local 模式跳过 sandbox host mount 查询（避免旧 sandbox 记录污染），直接用持久化目录。
    const fromPool = !isLocal && this.deps.getSandboxHostMount
      ? await this.deps.getSandboxHostMount(agentId)
      : null;
    const root = fromPool ?? agentSandboxHostMount(this.deps.dataDir, agentId);
    if (isLocal) {
      // local 持久化工作区：agent 未 run 时也允许访问，自动创建空目录。
      await fs.mkdir(root, { recursive: true });
      return root;
    }
    try {
      await fs.access(root);
    } catch {
      throw new AppError(404, 'workspace_not_provisioned', 'workspace_not_provisioned');
    }
    return root;
  }

  private resolveRelativePath(inputPath: string): string {
    try {
      return resolveWorkspaceRelativePath(inputPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'path_invalid';
      throw new AppError(400, message, 'path_invalid');
    }
  }

  private async buildTree(root: string, dir: string, rel = ''): Promise<WorkspaceTreeNode[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const nodes: WorkspaceTreeNode[] = [];
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
      const entryRel = rel ? `${rel}/${entry.name}` : entry.name;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        nodes.push({
          path: entryRel,
          name: entry.name,
          type: 'directory',
          children: await this.buildTree(root, abs, entryRel),
        });
      } else if (entry.isFile()) {
        const stat = await fs.stat(abs);
        nodes.push({
          path: entryRel,
          name: entry.name,
          type: 'file',
          size: stat.size,
          updatedAt: stat.mtimeMs,
        });
      }
    }
    return nodes;
  }
}
