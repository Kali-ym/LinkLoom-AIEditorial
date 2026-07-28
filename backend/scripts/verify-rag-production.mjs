import assert from 'node:assert/strict';

const baseUrl = (process.env.LINKLOOM_BASE_URL || process.env.BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const adminToken = process.env.LINKLOOM_TOKEN || process.env.AUTH_TOKEN || '';
const adminPassword = process.env.LINKLOOM_PASSWORD || process.env.SYSTEM_PASSWORD || '';
const query = process.env.RAG_VERIFY_QUERY || 'LinkLoom RAG 生产化验证';
const categoryIds = parseCsv(process.env.RAG_VERIFY_CATEGORY_IDS);
const documentIds = parseCsv(process.env.RAG_VERIFY_DOCUMENT_IDS);
const reindexLimit = toInt(process.env.RAG_VERIFY_REINDEX_LIMIT, 5);
const runOnceLimit = toInt(process.env.RAG_VERIFY_RUN_ONCE_LIMIT, 5);
const dryRun = process.env.RAG_VERIFY_DRY_RUN !== 'false';

function parseCsv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function toInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

async function request(path, options = {}, token = '') {
  const headers = {
    ...(options.body ? { 'content-type': 'application/json' } : {}),
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    throw new Error(`${options.method || 'GET'} ${path} failed: ${response.status} ${text}`);
  }
  return body;
}

async function resolveToken() {
  if (adminToken) return adminToken;
  if (!adminPassword) {
    throw new Error('需要设置 LINKLOOM_TOKEN/AUTH_TOKEN，或设置 LINKLOOM_PASSWORD/SYSTEM_PASSWORD 用于登录。');
  }
  const login = await request('/api/login', {
    method: 'POST',
    body: JSON.stringify({ password: adminPassword })
  });
  assert.equal(typeof login.token, 'string', 'login.token 必须存在');
  return login.token;
}

const token = await resolveToken();

const status = await request('/api/rag/status', {}, token);
assert.equal(status.productized, true, 'RAG status.productized 应为 true');
assert.ok(['fts', 'hybrid', 'hybrid+rerank', 'degraded'].includes(status.runtimeMode), 'runtimeMode 非法');
assert.ok(
  ['disabled', 'fts_only', 'indexing', 'hybrid_ready', 'degraded', 'rebuild_required'].includes(status.readiness),
  'readiness 非法'
);
assert.equal(typeof status.coverage, 'object', 'coverage 必须存在');
assert.equal(typeof status.coverage.totalChunkCount, 'number', 'coverage.totalChunkCount 必须是数字');
assert.equal(typeof status.jobStats, 'object', 'jobStats 必须存在');

const reindexBody = {
  limit: reindexLimit,
  dryRun,
  onlyMissing: true,
  targetStorage: 'dual',
  ...(categoryIds.length ? { categoryIds } : {}),
  ...(documentIds.length ? { documentIds } : {})
};
const reindex = await request('/api/rag/reindex', {
  method: 'POST',
  body: JSON.stringify(reindexBody)
}, token);
assert.ok(['queued', 'success', 'disabled'].includes(reindex.status), 'reindex.status 非法');
assert.equal(typeof reindex.chunksScanned, 'number', 'reindex.chunksScanned 必须是数字');
assert.equal(typeof reindex.queued, 'number', 'reindex.queued 必须是数字');

const runOnce = await request('/api/rag/jobs/run-once', {
  method: 'POST',
  body: JSON.stringify({ limit: runOnceLimit })
}, token);
assert.ok(['success', 'partial', 'disabled'].includes(runOnce.status), 'jobs/run-once.status 非法');
assert.equal(typeof runOnce.claimed, 'number', 'jobs/run-once.claimed 必须是数字');

const jobs = await request('/api/rag/jobs?limit=5', {}, token);
assert.equal(Array.isArray(jobs.jobs), true, 'jobs.jobs 必须是数组');

const queryResult = await request('/api/kb/query', {
  method: 'POST',
  body: JSON.stringify({
    query,
    limit: 3,
    ...(categoryIds.length ? { categoryIds } : {}),
    ...(documentIds.length ? { documentIds } : {})
  })
}, token);
assert.equal(typeof queryResult.answer, 'string', 'query.answer 必须是字符串');
assert.ok(queryResult.answer.length > 0, 'query.answer 不能为空');
assert.equal(typeof queryResult.meta, 'object', 'query.meta 必须存在');
assert.ok(['fts', 'hybrid', 'hybrid+rerank'].includes(queryResult.meta.retrievalMode), 'query.meta.retrievalMode 非法');
assert.equal(Array.isArray(queryResult.sources), true, 'query.sources 必须是数组');

console.log(JSON.stringify({
  status: {
    runtimeMode: status.runtimeMode,
    readiness: status.readiness,
    vectorStorageMode: status.vectorStorageMode,
    fallbackReason: status.fallbackReason,
    coverage: status.coverage,
    jobStats: status.jobStats
  },
  reindex: {
    status: reindex.status,
    dryRun: reindex.dryRun,
    chunksScanned: reindex.chunksScanned,
    queued: reindex.queued,
    alreadyIndexed: reindex.alreadyIndexed
  },
  runOnce: {
    status: runOnce.status,
    claimed: runOnce.claimed,
    succeeded: runOnce.succeeded,
    skipped: runOnce.skipped,
    failed: runOnce.failed
  },
  query: {
    retrievalMode: queryResult.meta.retrievalMode,
    fallbackReason: queryResult.meta.fallbackReason,
    sourceCount: queryResult.meta.sourceCount,
    sources: queryResult.sources.length
  }
}, null, 2));