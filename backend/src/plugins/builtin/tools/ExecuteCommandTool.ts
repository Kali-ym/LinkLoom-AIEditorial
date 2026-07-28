import { exec } from 'child_process';
import path from 'path';
import { promisify } from 'util';
import type { ToolExecutionPolicy } from '../../../types/agent.js';
import { isPerAgentDockerWorkspace } from '../../../services/agents/engine/AgentSandboxTypes.js';
import {
  createDefaultDockerExecRunner,
  type DockerExecRunner
} from '../../../services/agents/engine/DockerExecRunner.js';
import type { ToolExecutionContext } from '../../../services/ToolExecutionContext.js';
import { LogService } from '../../../services/LogService.js';
import { BaseTool } from '../../base/BaseTool.js';

const execAsync = promisify(exec);

export interface ExecResult {
  stdout: string;
  stderr: string;
  code?: number;
}

export interface ExecuteCommandToolOptions {
  dockerExecRunner?: DockerExecRunner;
}

export class ExecuteCommandTool extends BaseTool {
  readonly id = 'execute_command';
  readonly name = 'execute_command';
  readonly displayName = '执行命令';
  readonly scope = 'system' as const;
  readonly description =
    '在当前工作区或沙箱容器中执行 shell 命令，用于运行 Skill 脚本或系统命令。' +
    '删除文件请使用 rm 命令（如 rm path/to/file）。' +
    '仅限 Skill 明确要求或无法通过其他工具完成时调用，属高风险操作。必填：command；可选 cwd（工作目录）。';
  readonly parameters = {
    type: 'object',
    properties: {
      command: { type: 'string', description: '要执行的完整命令行指令' },
      cwd: { type: 'string', description: '执行命令的工作目录 (可选)' }
    },
    required: ['command']
  };
  readonly execution: ToolExecutionPolicy = {
    readonly: false,
    riskLevel: 'high',
    capabilities: ['process.exec', 'filesystem.read', 'filesystem.write']
  };

  private static readonly blockedCommands = ['rm -rf', 'format', 'mkfs'];
  private readonly dockerExecRunner: DockerExecRunner;

  constructor(options: ExecuteCommandToolOptions = {}) {
    super();
    this.dockerExecRunner = options.dockerExecRunner ?? createDefaultDockerExecRunner();
  }

  async handler(args: { command: string; cwd?: string }, context?: ToolExecutionContext): Promise<ExecResult> {
    const { command } = args;
    LogService.info(`Executing approved command: ${command}`);

    if (
      process.env.NODE_ENV === 'production' &&
      process.env.ENABLE_EXECUTE_COMMAND_TOOL !== '1' &&
      !isPerAgentDockerWorkspace(context?.workspace)
    ) {
      throw new Error('execute_command is disabled in production.');
    }

    if (this.isBlocked(command, context)) {
      throw new Error(`Command blocked for safety: ${command}`);
    }

    if (context?.signal?.aborted) {
      throw new Error('Command cancelled before execution');
    }

    if (isPerAgentDockerWorkspace(context?.workspace)) {
      return this.execInSandbox(command, args.cwd, context!);
    }

    const cwd = this.resolveLocalCwd(args.cwd, context);
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd,
        timeout: Number(process.env.EXECUTE_COMMAND_TIMEOUT_MS || 30_000),
        maxBuffer: Number(process.env.EXECUTE_COMMAND_MAX_BUFFER || 1024 * 1024),
        signal: context?.signal
      });
      return this.toRenderResult(command, stdout, stderr, 0);
    } catch (error: any) {
      if (context?.signal?.aborted || error?.name === 'AbortError') {
        return this.toRenderResult(
          command,
          error.stdout || '',
          error.stderr || 'Command cancelled',
          typeof error.code === 'number' ? error.code : 130
        );
      }
      LogService.error(`Command failed: ${command}\nError: ${error.message}`);
      return this.toRenderResult(
        command,
        error.stdout || '',
        error.stderr || error.message,
        error.code || 1
      );
    }
  }

  private async execInSandbox(
    command: string,
    cwd: string | undefined,
    context: ToolExecutionContext
  ): Promise<ExecResult> {
    const containerId = String(context.workspace!.metadata!.containerId);
    const workingDir = this.resolveSandboxCwd(cwd);

    try {
      const result = await this.dockerExecRunner.exec({
        containerId,
        command,
        cwd: workingDir,
        timeoutMs: Number(process.env.EXECUTE_COMMAND_TIMEOUT_MS || 30_000),
        signal: context.signal
      });

      if (context.signal?.aborted) {
        return this.toRenderResult(command, result.stdout, result.stderr || 'Command cancelled', 130);
      }

      return this.toRenderResult(command, result.stdout, result.stderr, result.exitCode);
    } catch (error: any) {
      if (context.signal?.aborted) {
        return this.toRenderResult(command, '', error?.message || 'Command cancelled', 130);
      }
      LogService.error(`Sandbox command failed: ${command}\nError: ${error.message}`);
      return this.toRenderResult(command, '', error?.message || String(error), 1);
    }
  }

  private toRenderResult(
    command: string,
    stdout: string,
    stderr: string,
    code: number
  ): ExecResult & { command: string; exitCode: number; output: string } {
    return {
      command,
      stdout,
      stderr,
      code,
      exitCode: code,
      output: stdout
    };
  }

  private resolveLocalCwd(cwd: string | undefined, context?: ToolExecutionContext): string | undefined {
    const workspaceMode = context?.workspace?.mode ?? context?.workspacePolicy?.mode;
    if (workspaceMode === 'none') {
      throw new Error('execute_command requires an active workspace; current workspace mode is none');
    }
    if (workspaceMode === 'docker' || workspaceMode === 'remote') {
      throw new Error(`${workspaceMode} workspace backend is not available for local command execution`);
    }

    const workspaceRoot = context?.workspace?.mode === 'local' ? context.workspace.rootDir : undefined;
    if (!workspaceRoot) return cwd;
    if (!cwd) return workspaceRoot;

    const resolved = path.isAbsolute(cwd) ? cwd : path.resolve(workspaceRoot, cwd);
    const relative = path.relative(workspaceRoot, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error(`cwd must stay inside active workspace: ${cwd}`);
    }
    return resolved;
  }

  private resolveSandboxCwd(cwd: string | undefined, workspaceRoot = '/workspace'): string {
    if (!cwd) return workspaceRoot;
    const resolved = cwd.startsWith('/') ? cwd : path.posix.join(workspaceRoot, cwd);
    const relative = path.posix.relative(workspaceRoot, resolved);
    if (relative.startsWith('..') || path.posix.isAbsolute(relative)) {
      throw new Error(`cwd must stay inside active workspace: ${cwd}`);
    }
    return resolved;
  }

  private isBlocked(command: string, context?: ToolExecutionContext): boolean {
    const cmdLower = command.toLowerCase();
    if (/\b(format|mkfs)\b/.test(cmdLower)) return true;

    if (isPerAgentDockerWorkspace(context?.workspace)) {
      // Per-agent sandboxes are isolated; workspace maintenance (including rm -rf) is allowed.
      return false;
    }

    for (const blocked of ExecuteCommandTool.blockedCommands) {
      if (cmdLower.includes(blocked)) return true;
    }
    return false;
  }
}
