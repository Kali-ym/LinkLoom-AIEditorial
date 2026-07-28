import assert from 'node:assert/strict';
import { LocalStore } from '../dist/services/LocalStore.js';
import { createServer } from '../dist/api/server.js';

const databaseUrl = process.env.DATABASE_URL || process.env.TEST_DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL or TEST_DATABASE_URL must be set for API smoke tests.');
  process.exit(1);
}

const store = new LocalStore(databaseUrl);
let server;

try {
  await store.init();
  await store.put('system_settings', {
    SYSTEM_PASSWORD: 'admin123',
    AUTH_EXPIRE_TIME: '1h',
    ACTIVE_AI_PROVIDER_ID: 'none',
    AI_PROVIDERS: [],
    ADAPTERS: [],
    PUBLISHERS: [],
    STORAGES: [],
    CLOSED_PLUGINS: [],
    CATEGORIES: [{ id: 'news', name: 'News' }]
  });

  server = await createServer(store);
  await server.ready();

  const login = await server.inject({
    method: 'POST',
    url: '/api/login',
    payload: { password: 'admin123' }
  });
  assert.equal(login.statusCode, 200);
  const loginBody = JSON.parse(login.body);
  assert.equal(typeof loginBody.token, 'string');

  const auth = { authorization: `Bearer ${loginBody.token}` };

  const unauthorized = await server.inject({ method: 'GET', url: '/api/settings' });
  assert.equal(unauthorized.statusCode, 401);
  assert.equal(typeof JSON.parse(unauthorized.body).error, 'string');

  const missingTempImagePath = await server.inject({
    method: 'GET',
    url: '/api/temp-image',
    headers: auth
  });
  assert.equal(missingTempImagePath.statusCode, 400);
  assert.equal(typeof JSON.parse(missingTempImagePath.body).error, 'string');

  const forbiddenTempImage = await server.inject({
    method: 'GET',
    url: '/api/temp-image?path=/etc/passwd',
    headers: auth
  });
  assert.equal(forbiddenTempImage.statusCode, 403);
  assert.equal(typeof JSON.parse(forbiddenTempImage.body).error, 'string');

  const missingProxyUrl = await server.inject({
    method: 'GET',
    url: '/api/proxy/image',
    headers: auth
  });
  assert.equal(missingProxyUrl.statusCode, 400);
  assert.equal(typeof JSON.parse(missingProxyUrl.body).error, 'string');

  const missingHistory = await server.inject({
    method: 'POST',
    url: '/api/history/republish/not-found',
    headers: auth
  });
  assert.equal(missingHistory.statusCode, 404);
  assert.equal(typeof JSON.parse(missingHistory.body).error, 'string');

  const checks = [
    ['GET', '/api/settings', (body) => assert.equal(typeof body, 'object')],
    ['GET', '/api/plugins/metadata', (body) => assert.equal(typeof body, 'object')],
    ['GET', '/api/content', (body) => assert.equal(typeof body, 'object')],
    ['GET', '/api/agents', (body) => assert.equal(Array.isArray(body), true)],
    ['GET', '/api/skills', (body) => assert.equal(Array.isArray(body), true)],
    ['GET', '/api/workflows', (body) => assert.equal(Array.isArray(body), true)],
    ['GET', '/api/schedules', (body) => assert.equal(Array.isArray(body), true)],
    ['GET', '/api/kb/categories', (body) => assert.equal(Array.isArray(body), true)],
    ['GET', '/api/memory/categories', (body) => assert.equal(Array.isArray(body), true)],
    ['GET', '/api/ai/v1/discovery', (body) => assert.equal(typeof body, 'object')]
  ];

  for (const [method, url, validate] of checks) {
    const response = await server.inject({ method, url, headers: auth });
    assert.equal(
      response.statusCode,
      200,
      `${method} ${url} expected 200, got ${response.statusCode}: ${response.body}`
    );
    validate(JSON.parse(response.body));
  }

  console.log('API smoke tests passed.');
} finally {
  if (server) await server.close();
  await store.close();
}
