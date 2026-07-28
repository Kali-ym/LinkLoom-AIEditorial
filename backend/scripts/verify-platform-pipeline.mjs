/**
 * 真实数据库上的平台管线端到端验证（in-process Fastify inject，无需额外端口）。
 *
 * 用法：
 *   POSTGRES_HOST=127.0.0.1 node backend/scripts/verify-platform-pipeline.mjs
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

function log(step, detail) {
  console.log(`[verify] ${step}: ${detail}`);
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
  assert.equal(login.statusCode, 200, `login failed: ${JSON.stringify(login.body)}`);
  const auth = { authorization: `Bearer ${login.body.token}` };

  // --- 平台路由可达 ---
  const gov = await injectJson(server, {
    method: 'GET',
    url: '/api/platform/governance/status',
    headers: auth
  });
  assert.equal(gov.statusCode, 200, `governance: ${JSON.stringify(gov.body)}`);
  log('governance', `policy=${gov.body.policyVersion} tools=${gov.body.toolCount}`);

  // --- 新闻管线 ---
  let pipelineStatus = await injectJson(server, {
    method: 'GET',
    url: '/api/platform/news-pipeline/status',
    headers: auth
  });
  assert.equal(pipelineStatus.statusCode, 200, JSON.stringify(pipelineStatus.body));
  log('news-pipeline/status', `ready=${pipelineStatus.body.ready}`);

  if (!pipelineStatus.body.ready) {
    const setup = await injectJson(server, {
      method: 'POST',
      url: '/api/platform/news-pipeline/setup',
      headers: auth,
      payload: { enableSchedules: false }
    });
    assert.equal(setup.statusCode, 200, JSON.stringify(setup.body));
    log('news-pipeline/setup', `created=${(setup.body.created || []).length}`);
    pipelineStatus = await injectJson(server, {
      method: 'GET',
      url: '/api/platform/news-pipeline/status',
      headers: auth
    });
    assert.equal(pipelineStatus.body.ready, true, 'pipeline should be ready after setup');
  }

  // --- 扩展管线 ---
  const extSetup = await injectJson(server, {
    method: 'POST',
    url: '/api/platform/pipelines/setup',
    headers: auth,
    payload: { enableSchedules: false }
  });
  assert.equal(extSetup.statusCode, 200, JSON.stringify(extSetup.body));
  log('pipelines/setup', `created=${(extSetup.body.created || []).length}`);

  const extStatus = await injectJson(server, {
    method: 'GET',
    url: '/api/platform/pipelines/status',
    headers: auth
  });
  assert.equal(extStatus.statusCode, 200);
  const readyCount = (extStatus.body.pipelines || []).filter((p) => p.ready).length;
  log('pipelines/status', `ready=${readyCount}/${(extStatus.body.pipelines || []).length}`);

  // --- 触发新闻生产（可能因无素材/quick finish；重点验证编排 run 记录与审批门控）---
  const run = await injectJson(server, {
    method: 'POST',
    url: '/api/platform/news-pipeline/run',
    headers: auth
  });
  assert.equal(run.statusCode, 200, JSON.stringify(run.body));
  log('news-pipeline/run', run.body.message || run.body.status);

  // 等待编排 run 写入
  await sleep(2500);

  const workflowRuns = await injectJson(server, {
    method: 'GET',
    url: '/api/workflow-runs?workflowId=wf_news_production_chain&limit=5',
    headers: auth
  });
  assert.equal(workflowRuns.statusCode, 200);
  const latestRun = workflowRuns.body.items?.[0];
  assert(latestRun, 'expected at least one workflow run for news chain');
  log(
    'workflow-run',
    `${latestRun.workflowRunId} status=${latestRun.status} steps=${latestRun.steps?.length ?? 0}`
  );

  // --- 待审批聚合（含编排 paused）---
  const pending = await injectJson(server, {
    method: 'GET',
    url: '/api/agent-runs/permissions/pending',
    headers: auth
  });
  assert.equal(pending.statusCode, 200);
  log('pending-permissions', `count=${pending.body.length}`);

  const workflowPending = (pending.body || []).filter((item) => item.kind === 'workflow');
  if (workflowPending.length > 0) {
    const item = workflowPending[0];
    log('approval-test', `found workflow pending: ${item.permission?.subject?.toolName}`);
    const approve = await injectJson(server, {
      method: 'POST',
      url: `/api/workflow-runs/${item.workflowRunId}/permissions/${item.permission.permissionId}/approve`,
      headers: auth,
      payload: { reason: 'e2e verify approve' }
    });
    assert.equal(approve.statusCode, 200, `workflow approve failed: ${JSON.stringify(approve.body)}`);
    log('workflow-approve', `status=${approve.statusCode}`);

    await sleep(3000);
    const afterApprove = await injectJson(server, {
      method: 'GET',
      url: `/api/workflow-runs/${item.workflowRunId}`,
      headers: auth
    });
    assert.equal(afterApprove.statusCode, 200);
    log('workflow-run-after-approve', `status=${afterApprove.body.status}`);
    assert(
      ['succeeded', 'paused', 'running'].includes(afterApprove.body.status),
      `unexpected run status after approve: ${afterApprove.body.status}`
    );
  } else if (latestRun.status === 'paused') {
    log('approval-test', 'run paused but no pending item in API — check registry sync');
  } else {
    log('approval-test', `skipped (run=${latestRun.status}, no workflow pending)`);
  }

  // --- 观测 ---
  const metrics = await injectJson(server, {
    method: 'GET',
    url: '/api/agent-runs/observability/metrics',
    headers: auth
  });
  assert.equal(metrics.statusCode, 200);
  log('observability', `runs=${metrics.body.totalRuns} tokens=${metrics.body.tokenUsage?.totalTokens ?? 0}`);

  const alerts = await injectJson(server, {
    method: 'GET',
    url: '/api/agent-runs/observability/alerts',
    headers: auth
  });
  assert.equal(alerts.statusCode, 200);
  log('alerts', `count=${alerts.body.length}`);

  console.log('\n✅ Platform pipeline verification passed.');
} catch (error) {
  console.error('\n❌ Platform pipeline verification failed.');
  console.error(error);
  process.exitCode = 1;
} finally {
  if (server) await server.close();
  await store.close?.();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
