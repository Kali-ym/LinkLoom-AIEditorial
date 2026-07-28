/**
 * DigestContext API 验证（in-process Fastify inject）。
 *
 * 用法：POSTGRES_HOST=127.0.0.1 node backend/scripts/verify-digest-context.mjs
 */
import assert from 'node:assert/strict';
import { createServer } from '../dist/api/server.js';
import { LocalStore } from '../dist/services/LocalStore.js';

function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const host = process.env.POSTGRES_HOST || '127.0.0.1';
  const port = process.env.POSTGRES_PORT || '5432';
  const user = process.env.POSTGRES_USER || 'linkloom';
  const password = process.env.POSTGRES_PASSWORD || 'linkloom';
  const db = process.env.POSTGRES_DB || 'linkloom';
  return `postgres://${user}:${password}@${host}:${port}/${db}`;
}

async function injectJson(server, opts) {
  const res = await server.inject(opts);
  let body;
  try {
    body = JSON.parse(res.body);
  } catch {
    body = res.body;
  }
  return { statusCode: res.statusCode, body };
}

const databaseUrl = resolveDatabaseUrl();
const store = new LocalStore(databaseUrl);
let server;

try {
  await store.init();
  const settings = (await store.get('system_settings')) || {};
  const password = process.env.SYSTEM_PASSWORD || settings.SYSTEM_PASSWORD || 'admin123';
  server = await createServer(store);
  await server.ready();

  const login = await injectJson(server, {
    method: 'POST',
    url: '/api/login',
    payload: { password }
  });
  assert.equal(login.statusCode, 200);
  const auth = { authorization: `Bearer ${login.body.token}` };

  const date = new Date().toISOString().slice(0, 10);
  const ctx = await injectJson(server, {
    method: 'GET',
    url: `/api/editorial/digest-context?date=${date}`,
    headers: auth
  });
  assert.equal(ctx.statusCode, 200, JSON.stringify(ctx.body));
  assert.equal(typeof ctx.body.date, 'string');
  assert.ok(Array.isArray(ctx.body.suggestedDailyOneXTopics));
  assert.ok(Array.isArray(ctx.body.hotHeadlines));
  console.log(
    `[verify] digest-context date=${ctx.body.date} stale=${ctx.body.stale} topics=${ctx.body.suggestedDailyOneXTopics.length}`
  );

  const rag = await injectJson(server, { method: 'GET', url: '/api/rag/status', headers: auth });
  assert.equal(rag.statusCode, 200);
  console.log(`[verify] rag hybridEnabled=${rag.body.hybridEnabled}`);

  const bizSetup = await injectJson(server, {
    method: 'POST',
    url: '/api/platform/business-pipelines/setup',
    headers: auth,
    payload: { enableSchedules: false }
  });
  assert.equal(bizSetup.statusCode, 200, JSON.stringify(bizSetup.body));

  const bizStatus = await injectJson(server, {
    method: 'GET',
    url: '/api/platform/business-pipelines/status',
    headers: auth
  });
  assert.equal(bizStatus.statusCode, 200);
  assert.ok(bizStatus.body.pipelines?.length >= 4);
  console.log(`[verify] business pipelines=${bizStatus.body.pipelines.length}`);

  console.log('\n✅ Digest context verification passed.');
} catch (error) {
  console.error('\n❌ Digest context verification failed.');
  console.error(error);
  process.exitCode = 1;
} finally {
  if (server) await server.close();
  await store.close?.();
}
