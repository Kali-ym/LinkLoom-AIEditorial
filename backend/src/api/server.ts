import path from 'path';
import { fileURLToPath } from 'url';
import cors from '@fastify/cors';
import formbody from '@fastify/formbody';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import Fastify from 'fastify';
import { LocalStore } from '../services/LocalStore.js';
import { LogService } from '../services/LogService.js';
import { MonitoringService } from '../services/MonitoringService.js';
import { ServiceContext } from '../services/ServiceContext.js';
import { assertProductionSettings } from '../services/settingsSecurity.js';
import { extractInteropApiKey } from './extractInteropApiKey.js';
import { httpErrorHandler } from './http.js';
import { registerAgentRoutes } from './routes/agentRoutes.js';
import { registerAgentWorkspaceRoutes } from './routes/agentWorkspaceRoutes.js';
import { registerAgentBindingRoutes } from './routes/agentBindingRoutes.js';
import { registerAgentUploadRoutes } from './routes/agentUploadRoutes.js';
import { registerAiBuilderRoutes } from './routes/aiBuilderRoutes.js';
import { registerAuthRoutes } from './routes/authRoutes.js';
import { registerChannelPlatformRoutes } from './routes/channelPlatformRoutes.js';
import { registerConsoleSearchRoutes } from './routes/consoleSearchRoutes.js';
import { registerContentRoutes } from './routes/contentRoutes.js';
import { registerDashboardRoutes } from './routes/dashboardRoutes.js';
import { registerEditorialRoutes } from './routes/editorialRoutes.js';
import { FEED_PUBLIC_PREFIXES, registerFeedRoutes } from './routes/feedRoutes.js';
import { registerGatewayRoutes } from './routes/gatewayRoutes.js';
import { registerHealthRoutes } from './routes/healthRoutes.js';
import { registerInteropRoutes } from './routes/interopRoutes.js';
import { registerKnowledgeRoutes } from './routes/knowledgeRoutes.js';
import { registerRagRoutes } from './routes/ragRoutes.js';
import { registerMcpRoutes } from './routes/mcpRoutes.js';
import { registerMemoryRoutes } from './routes/memoryRoutes.js';
import { registerPublishRoutes } from './routes/publishRoutes.js';
import { registerScheduleRoutes } from './routes/scheduleRoutes.js';
import { registerSettingsRoutes } from './routes/settingsRoutes.js';
import { registerSkillRoutes } from './routes/skillRoutes.js';
import { registerStaticRoutes } from './routes/staticRoutes.js';
import { registerTemplateRoutes } from './routes/templateRoutes.js';
import { registerToolAuthRoutes } from './routes/toolAuthRoutes.js';
import { registerToolRoutes } from './routes/toolRoutes.js';
import { registerPlatformRoutes } from './routes/platformRoutes.js';
import { registerWorkflowRoutes } from './routes/workflowRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');

/** 仅非 production 且未配置 JWT_SECRET 时的本地回退，禁止用于对外部署。 */
const LOCAL_JWT_FALLBACK = 'linkloom-local-jwt-fallback-not-for-production';
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (secret) {
    return secret;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '未设置 JWT_SECRET：请在环境变量或根目录 .env 中配置 JWT_SECRET（生产环境必填）。'
    );
  }
  LogService.warn(
    'JWT_SECRET 未设置，已使用内置本地回退密钥（仅限本机调试）。生产部署必须在环境变量或 .env 中设置 JWT_SECRET。'
  );
  return LOCAL_JWT_FALLBACK;
}

export async function createServer(existingStore?: LocalStore) {
  const fastify = Fastify({
    logger: true,
    bodyLimit: 10 * 1024 * 1024,
    routerOptions: {
      maxParamLength: 5000
    }
  });
  const store = existingStore || new LocalStore();
  if (!existingStore) {
    await store.init();
  }

  const context = await ServiceContext.getInstance(store);
  assertProductionSettings(context.settings);

  fastify.register(formbody);
  fastify.register(cors, { origin: resolveCorsOrigin });
  fastify.register(jwt, { secret: resolveJwtSecret() });
  fastify.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } });
  fastify.setErrorHandler(httpErrorHandler);

  const adminDistPath = path.join(projectRoot, 'admin', 'dist');
  const routeDeps = { store, context, projectRoot, adminDistPath };

  fastify.addHook('onRequest', async (request, reply) => {
    (request as any).startedAt = Date.now();
    reply.header('x-content-type-options', 'nosniff');
    reply.header('x-frame-options', 'DENY');
    reply.header('referrer-policy', 'same-origin');
    reply.header('x-request-id', request.id);
  });

  fastify.addHook('onResponse', async (request, reply) => {
    MonitoringService.recordHttp({
      method: request.method,
      route: request.routeOptions.url || request.url,
      statusCode: reply.statusCode,
      durationMs: Math.max(0, Date.now() - ((request as any).startedAt || Date.now()))
    });
  });

  await registerStaticRoutes(fastify, routeDeps);
  await registerHealthRoutes(fastify, routeDeps);

  fastify.addHook('preHandler', async (request, reply) => {
    const publicPaths = [
      '/api/health',
      '/api/ready',
      '/api/login',
      '/api/ai/v1/register',
      '/api/ai/v1/verify',
      '/api/tool-auth/consent',
      '/api/tool-auth/complete'
    ];
    const isPublicFeed =
      FEED_PUBLIC_PREFIXES.some((p) => request.url.startsWith(p)) &&
      !request.url.startsWith('/api/feed/admin');
    if (
      isPublicFeed ||
      publicPaths.some((publicPath) => request.url.startsWith(publicPath)) ||
      !request.url.startsWith('/api')
    ) {
      if (request.url.startsWith('/api/login') || request.url.startsWith('/api/ai/v1/register')) {
        const allowed = consumeRateLimit(`${request.ip}:${request.url.split('?')[0]}`);
        if (!allowed) {
          return reply.status(429).send({ error: 'Too many requests' });
        }
      }
      return;
    }

    try {
      const apiKey = extractInteropApiKey(request.headers);
      if (apiKey) {
        const isValid = await context.interopService.verifyApiKey(apiKey);
        if (isValid) {
          // Interop keys authenticate machine peers and standalone Agent Console.
          (request as any).isApiKeyAuth = true;
          return;
        }
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const queryToken = (request.query as any)?.token;
      if (queryToken) {
        fastify.jwt.verify(queryToken);
        return;
      }

      await request.jwtVerify();
    } catch {
      reply.status(401).send({ error: 'Unauthorized' });
    }
  });

  await registerAuthRoutes(fastify, routeDeps);
  await registerDashboardRoutes(fastify, routeDeps);
  await registerPublishRoutes(fastify, routeDeps);
  await registerContentRoutes(fastify, routeDeps);
  await registerConsoleSearchRoutes(fastify, routeDeps);
  await registerSettingsRoutes(fastify, routeDeps);
  await registerInteropRoutes(fastify, routeDeps);
  await registerAgentRoutes(fastify, routeDeps);
  await registerAgentWorkspaceRoutes(fastify, routeDeps);
  await registerAgentBindingRoutes(fastify, routeDeps);
  await registerAgentUploadRoutes(fastify, routeDeps);
  await registerSkillRoutes(fastify, routeDeps);
  await registerToolRoutes(fastify, routeDeps);
  await registerToolAuthRoutes(fastify, routeDeps);
  await registerWorkflowRoutes(fastify, routeDeps);
  await registerPlatformRoutes(fastify, routeDeps);
  await registerAiBuilderRoutes(fastify, routeDeps);
  await registerTemplateRoutes(fastify, routeDeps);
  await registerEditorialRoutes(fastify, routeDeps);
  await registerScheduleRoutes(fastify, routeDeps);
  await registerMcpRoutes(fastify, routeDeps);
  await registerKnowledgeRoutes(fastify, routeDeps);
  await registerRagRoutes(fastify, routeDeps);
  await registerMemoryRoutes(fastify, routeDeps);
  await registerFeedRoutes(fastify, routeDeps);
  await registerGatewayRoutes(fastify, routeDeps);
  await registerChannelPlatformRoutes(fastify, routeDeps);

  return fastify;
}

async function resolveCorsOrigin(origin: string | undefined): Promise<boolean> {
  if (!origin) return true;
  if (process.env.NODE_ENV !== 'production') return true;

  const allowed = (process.env.CORS_ORIGINS || process.env.PUBLIC_ORIGIN || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return allowed.includes(origin);
}

function consumeRateLimit(key: string): boolean {
  const windowMs = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 60_000);
  const max = Number(process.env.AUTH_RATE_LIMIT_MAX || 20);
  const now = Date.now();
  const bucket = rateLimitBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count++;
  return bucket.count <= max;
}
