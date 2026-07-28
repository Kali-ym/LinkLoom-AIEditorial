import { spawn, type ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer } from './api/server.js';
import {
  getListenHost,
  getNextPort,
  getPort,
  resolveBackendInternalUrl,
  resolveNextUpstreamUrl
} from './config/runtimeEnv.js';
import { LocalStore } from './services/LocalStore.js';
import { LogService } from './services/LogService.js';
import { ServiceContext } from './services/ServiceContext.js';
import { initSentry } from './utils/sentry.js';

dotenv.config();
initSentry();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');

let nextProcess: ChildProcess | null = null;
let nextRestartTimer: NodeJS.Timeout | null = null;
let shuttingDown = false;

function resolveStandaloneEntry(): string | null {
  const standaloneServer = path.join(
    PROJECT_ROOT,
    'web',
    '.next',
    'standalone',
    'web',
    'server.js'
  );
  const standaloneServerFlatPath = path.join(
    PROJECT_ROOT,
    'web',
    '.next',
    'standalone',
    'server.js'
  );
  if (fs.existsSync(standaloneServer)) return standaloneServer;
  if (fs.existsSync(standaloneServerFlatPath)) return standaloneServerFlatPath;
  LogService.warn(
    `[next] 未找到 standalone server.js（已查询 ${standaloneServer} 与 ${standaloneServerFlatPath}），请先执行 pnpm --filter ./web run build。`
  );
  return null;
}

async function waitForNextReady(upstream: string, timeoutMs = 15_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(upstream, { method: 'HEAD' });
      if (res.status < 500) return true;
    } catch {
      // Next standalone is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

async function spawnNextStandalone(
  nextPort: number,
  upstream: string,
  restartAttempt = 0
): Promise<void> {
  if (process.env.SKIP_NEXT_SPAWN === '1') {
    LogService.info(
      '[next] SKIP_NEXT_SPAWN=1，未启动 Next.js 子进程；请确保 NEXT_UPSTREAM_URL 指向已运行的 Next standalone 服务。'
    );
    return;
  }

  const serverEntry = resolveStandaloneEntry();
  if (!serverEntry) {
    return;
  }

  const cwd = path.dirname(serverEntry);
  const env = {
    ...process.env,
    PORT: String(nextPort),
    HOSTNAME: '127.0.0.1',
    NODE_ENV: process.env.NODE_ENV || 'production',
    BACKEND_INTERNAL_URL: resolveBackendInternalUrl()
  };

  LogService.info(`[next] spawning standalone server: ${serverEntry} (port=${nextPort})`);
  const child = spawn(process.execPath, [serverEntry], {
    cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  child.stdout?.on('data', (chunk) => {
    process.stdout.write(`[next] ${chunk}`);
  });
  child.stderr?.on('data', (chunk) => {
    process.stderr.write(`[next:err] ${chunk}`);
  });
  child.on('exit', (code, signal) => {
    LogService.warn(`[next] standalone exited code=${code} signal=${signal}`);
    nextProcess = null;
    if (!shuttingDown && process.env.SKIP_NEXT_RESTART !== '1') {
      const delay = Math.min(30_000, 2_000 * Math.max(1, restartAttempt + 1));
      LogService.warn(`[next] restarting standalone in ${delay}ms...`);
      nextRestartTimer = setTimeout(() => {
        void spawnNextStandalone(nextPort, upstream, restartAttempt + 1);
      }, delay);
    }
  });

  nextProcess = child;

  const ready = await waitForNextReady(upstream);
  if (ready) {
    LogService.info(`[next] standalone ready at ${upstream}`);
  } else {
    LogService.warn(`[next] standalone did not become ready within timeout: ${upstream}`);
  }
}

function shutdownNext(): void {
  shuttingDown = true;
  if (nextRestartTimer) {
    clearTimeout(nextRestartTimer);
    nextRestartTimer = null;
  }
  if (nextProcess && !nextProcess.killed) {
    LogService.info('[next] terminating standalone server...');
    try {
      nextProcess.kill('SIGTERM');
    } catch {
      // ignore
    }
  }
}

let backendShutdownPromise: Promise<void> | null = null;
async function shutdownBackend(): Promise<void> {
  if (!backendShutdownPromise) {
    backendShutdownPromise = (async () => {
      shutdownNext();
      try {
        const ctx = await ServiceContext.getInstance();
        await ctx.schedulerService.shutdown();
      } catch (err: any) {
        LogService.warn(`Backend shutdown: scheduler shutdown failed: ${err?.message || err}`);
      }
    })();
  }
  return backendShutdownPromise;
}

function handleTerminationSignal(signal: NodeJS.Signals): void {
  LogService.info(`Received ${signal}, shutting down gracefully...`);
  // 给优雅退出一个保险期：3 秒后无论如何强退，防止某条 await 永远不返回阻塞 exit。
  const guard = setTimeout(() => {
    LogService.warn('Graceful shutdown exceeded 3000ms, forcing exit.');
    process.exit(0);
  }, 3000);
  if (typeof guard.unref === 'function') guard.unref();

  shutdownBackend()
    .catch((err) => LogService.warn(`shutdownBackend failed: ${err?.message || err}`))
    .finally(() => {
      clearTimeout(guard);
      process.exit(0);
    });
}

process.on('SIGINT', () => handleTerminationSignal('SIGINT'));
process.on('SIGTERM', () => handleTerminationSignal('SIGTERM'));

// Global error handlers to prevent process crash
process.on('uncaughtException', (error) => {
  LogService.error(`Uncaught Exception: ${error.message}`);
  if (error.stack) LogService.error(error.stack);
  // Do not exit, try to keep the service running
});

process.on('unhandledRejection', (reason, promise) => {
  LogService.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
});

async function bootstrap() {
  const store = new LocalStore();
  await store.init();

  // --- Initialize Service Context (Singleton) ---
  await ServiceContext.getInstance(store);

  const port = getPort();
  const listenHost = getListenHost();
  const nextPort = getNextPort();
  const nextUpstream = resolveNextUpstreamUrl();
  process.env.NEXT_UPSTREAM_URL = nextUpstream;

  await spawnNextStandalone(nextPort, nextUpstream);

  const server = await createServer(store);

  try {
    await server.listen({ port, host: listenHost });
    LogService.info(`Server listening on ${listenHost}:${port}`);
    LogService.info(`Next.js upstream expected at ${nextUpstream}`);
  } catch (err) {
    server.log.error(err);
    shutdownNext();
    process.exit(1);
  }
}

void bootstrap();
