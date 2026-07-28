import type { FastifyInstance } from 'fastify';
import type { LocalStore } from '../../services/LocalStore.js';
import type { ServiceContext } from '../../services/ServiceContext.js';

export interface ApiRouteDeps {
  store: LocalStore;
  context: ServiceContext;
  projectRoot: string;
  adminDistPath: string;
}

export type RouteRegistrar = (fastify: FastifyInstance, deps: ApiRouteDeps) => Promise<void> | void;
