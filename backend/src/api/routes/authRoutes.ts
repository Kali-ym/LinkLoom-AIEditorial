import { AuthService } from '../../services/api/AuthService.js';
import type { RouteRegistrar } from './types.js';

export const registerAuthRoutes: RouteRegistrar = (fastify, { context }) => {
  const authService = new AuthService(context);

  fastify.post('/api/login', async (request, reply) => {
    const { password } = request.body as any;
    const token = authService.signAdminToken(String(password ?? ''), (payload, options) =>
      fastify.jwt.sign(payload, options ?? {})
    );
    if (!token) {
      reply.status(401).send({ error: 'Invalid password' });
      return;
    }
    return { token };
  });
};
