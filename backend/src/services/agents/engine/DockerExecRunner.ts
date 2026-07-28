import { spawn } from 'child_process';

export interface DockerExecOptions {
  containerId: string;
  command: string;
  cwd?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface DockerExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface DockerExecRunner {
  exec(options: DockerExecOptions): Promise<DockerExecResult>;
}

export class CliDockerExecRunner implements DockerExecRunner {
  async exec(options: DockerExecOptions): Promise<DockerExecResult> {
    const timeoutMs =
      options.timeoutMs ?? Number(process.env.EXECUTE_COMMAND_TIMEOUT_MS || 30_000);
    const cwd = options.cwd ?? '/workspace';
    const args = ['exec', '-w', cwd, options.containerId, 'sh', '-c', options.command];

    return await new Promise<DockerExecResult>((resolve, reject) => {
      const child = spawn('docker', args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      let settled = false;

      const finish = (result: DockerExecResult | Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        options.signal?.removeEventListener('abort', onAbort);
        if (result instanceof Error) reject(result);
        else resolve(result);
      };

      const onAbort = () => {
        child.kill('SIGTERM');
        finish({
          stdout,
          stderr: stderr || 'Command cancelled',
          exitCode: 130
        });
      };

      child.stdout?.on('data', (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr?.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      options.signal?.addEventListener('abort', onAbort, { once: true });

      const timer = setTimeout(() => {
        child.kill('SIGTERM');
        finish(new Error(`docker exec timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      child.on('error', (error) => finish(error));
      child.on('close', (code) => {
        finish({ stdout, stderr, exitCode: code ?? 1 });
      });
    });
  }
}

let defaultRunner: DockerExecRunner | undefined;

export function createDefaultDockerExecRunner(): DockerExecRunner {
  if (!defaultRunner) defaultRunner = new CliDockerExecRunner();
  return defaultRunner;
}

export function setDefaultDockerExecRunnerForTests(runner: DockerExecRunner | undefined): void {
  defaultRunner = runner;
}
