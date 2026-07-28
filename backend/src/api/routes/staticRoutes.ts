import fs from 'fs';
import path from 'path';
import replyFrom from '@fastify/reply-from';
import fastifyStatic from '@fastify/static';
import { resolveNextUpstreamUrl } from '../../config/runtimeEnv.js';
import { LogService } from '../../services/LogService.js';
import type { RouteRegistrar } from './types.js';

function redirectToExternalConsole(url: string): string | null {
  const base = (process.env.CONSOLE_PUBLIC_URL || '').trim().replace(/\/$/, '');
  if (!base) return null;

  let rest = '';
  const legacyPrefix = '/admin/agents/console';
  if (url === legacyPrefix || url.startsWith(`${legacyPrefix}/`)) {
    rest = url.slice(legacyPrefix.length);
  } else if (url === '/console' || url.startsWith('/console/')) {
    rest = url.slice('/console'.length);
  } else {
    return base;
  }

  return `${base}${rest || '/'}`;
}

export const registerStaticRoutes: RouteRegistrar = async (fastify, { adminDistPath }) => {
  await fs.promises.mkdir(adminDistPath, { recursive: true });
  const nextUpstream = resolveNextUpstreamUrl();

  fastify.register(fastifyStatic, {
    root: adminDistPath,
    prefix: '/admin/',
  });

  await fastify.register(replyFrom, {
    base: nextUpstream,
    undici: {
      connections: 64,
      pipelining: 1
    }
  });

  fastify.setNotFoundHandler((request, reply) => {
    const url = request.url;

    if (url.startsWith('/api')) {
      return reply.status(404).send({ error: `API route not found: ${url}` });
    }

    const legacyPrefix = '/admin/agents/console';
    if (
      url === legacyPrefix ||
      url.startsWith(`${legacyPrefix}/`) ||
      url === '/console' ||
      url.startsWith('/console/')
    ) {
      const target = redirectToExternalConsole(url);
      if (target) {
        return reply.redirect(target, 302);
      }
      return reply
        .status(404)
        .type('text/plain')
        .send(
          'Agent Console is hosted separately. Deploy agent-console and set CONSOLE_PUBLIC_URL to its public origin.'
        );
    }

    if (url === '/admin' || url.startsWith('/admin/')) {
      const adminIndexPath = path.join(adminDistPath, 'index.html');
      if (fs.existsSync(adminIndexPath)) {
        return reply.type('text/html').send(fs.readFileSync(adminIndexPath, 'utf-8'));
      }
      return reply.status(404).send('Admin UI has not been built yet.');
    }

    return reply.from(url, {
      onError: (replyInner, error) => {
        LogService.warn(
          `[next-proxy] upstream error for ${url}: ${error?.error?.message || error}`
        );
        replyInner.status(502).type('text/plain').send('Next.js upstream is unavailable.');
      }
    });
  });
};
