import assert from 'node:assert/strict';
import { LocalStore } from '../dist/services/LocalStore.js';

const databaseUrl = process.env.DATABASE_URL || process.env.TEST_DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL or TEST_DATABASE_URL must be set for repository tests.');
  process.exit(1);
}

const store = new LocalStore(databaseUrl);

try {
  await store.init();

  await store.put('sample', { ok: true });
  assert.deepEqual(await store.get('sample'), { ok: true });
  assert.equal((await store.getAllKeys()).includes('sample'), true);

  await store.saveCommitHistory({
    date: '2026-05-19',
    platform: 'github',
    filePath: 'content/posts/test.md',
    commitMessage: 'repository smoke',
    fullContent: '# Smoke'
  });
  const history = await store.getCommitHistory({ search: 'smoke' });
  assert.equal(history.total, 1);
  assert.equal((await store.getCommittedDates())[0], '2026-05-19');

  await store.saveAgent({ id: 'agent-a', name: 'Agent A' });
  await store.saveSkill({ id: 'skill-a', name: 'skill-a' });
  await store.saveWorkflow({ id: 'workflow-a', name: 'Workflow A', steps: [] });
  await store.saveMCPConfig({ id: 'mcp-a', name: 'MCP A' });
  assert.equal((await store.getAgent('agent-a')).name, 'Agent A');
  assert.equal((await store.getSkill('skill-a')).name, 'skill-a');
  assert.equal((await store.getWorkflow('workflow-a')).name, 'Workflow A');
  assert.equal((await store.getMCPConfig('mcp-a')).name, 'MCP A');

  await store.saveSchedule({ id: 'schedule-a', name: 'Schedule A', enabled: false });
  const taskLogId = await store.saveTaskLog({
    taskId: 'task-a',
    taskName: 'Task A',
    startTime: '2026-05-19T00:00:00.000Z',
    status: 'running'
  });
  await store.updateTaskLog({
    id: taskLogId,
    endTime: '2026-05-19T00:00:01.000Z',
    duration: 1000,
    status: 'success',
    progress: 100,
    message: 'done',
    resultCount: 1
  });
  assert.equal((await store.listSchedules()).length, 1);
  assert.equal((await store.listTaskLogs({ taskId: 'task-a' }))[0].status, 'success');

  const raceLogId = await store.saveTaskLog({
    taskId: 'task-race',
    taskName: 'Race',
    startTime: '2026-05-19T01:00:00.000Z',
    status: 'running'
  });
  await store.updateTaskLog({
    id: raceLogId,
    endTime: '2026-05-19T01:00:00.200Z',
    duration: 200,
    status: 'success',
    progress: 100,
    message: 'done'
  });
  await store.updateTaskLog({
    id: raceLogId,
    progress: 100,
    status: 'running',
    message: '没有可处理的条目'
  });
  assert.equal((await store.listTaskLogs({ taskId: 'task-race' }))[0].status, 'success');

  const stuckLogId = await store.saveTaskLog({
    taskId: 'task-stuck',
    taskName: 'Stuck',
    startTime: '2026-05-19T02:00:00.000Z',
    status: 'running',
    progress: 100,
    message: '没有可处理的条目'
  });
  const healed = await store.reconcileStuckRunningTaskLogs();
  assert.equal(healed, 1);
  assert.equal((await store.listTaskLogs({ taskId: 'task-stuck' }))[0].status, 'success');

  await store.saveSourceData(
    {
      id: 'source-a',
      title: 'Alpha source',
      url: 'https://example.com/a',
      description: 'Searchable source description',
      published_date: '2026-05-19',
      source: 'rss',
      category: 'news',
      metadata: { ai_summary: 'unique smoke summary', ai_score: 8 }
    },
    '2026-05-19',
    'rss-adapter'
  );
  const alphaList = await store.listSourceData({ search: 'unique' });
  assert.equal(alphaList.total, 1);
  const alphaId = alphaList.items[0].id;
  await store.updateSourceDataStatus(alphaId, 'read');
  assert.equal((await store.getSourceData(alphaId)).status, 'read');
  await store.updateSourceDataMetadata(alphaId, { ai_summary: 'updated summary', ai_score: 9 });
  assert.equal((await store.listSourceData({ minScore: 9 })).total, 1);

  const urlDedupAdded = await store.saveSourceDataBatch(
    [
      {
        id: 'manual-1',
        title: 'Same article via UTM',
        url: 'https://example.com/a?utm_source=newsletter',
        description: 'noise',
        published_date: '2026-05-19',
        source: 'rss',
        category: 'news'
      }
    ],
    '2026-05-20',
    'rss-adapter'
  );
  assert.equal(urlDedupAdded, 0, 'utm-only difference should be deduped by URL');
  assert.equal((await store.listSourceData({ search: 'searchable' })).total, 1);

  await store.saveSourceData(
    {
      id: 'folo-entry-1',
      title: 'Old article',
      url: 'https://example.com/old?__biz=A&mid=1',
      description: 'old',
      published_date: '2026-05-14T05:05:00.000Z',
      source: '新智元',
      category: 'rss'
    },
    '2026-05-15',
    'Folo'
  );
  const reuseAdded = await store.saveSourceDataBatch(
    [
      {
        id: 'folo-entry-1',
        title: 'New article at reused id',
        url: 'https://example.com/old?__biz=A&mid=2',
        description: 'new',
        published_date: '2026-05-23T05:11:00.000Z',
        source: '新智元',
        category: 'rss'
      }
    ],
    '2026-05-24',
    'Folo'
  );
  assert.equal(reuseAdded, 1, 'reused entry id with different URL must insert');
  assert.equal(
    await store.getSourceData('folo-entry-1'),
    null,
    'storage id is no longer the upstream id'
  );
  const xinzhiyuanRows = await store.listSourceData({ source: '新智元' });
  assert.equal(xinzhiyuanRows.total, 2);
  for (const row of xinzhiyuanRows.items) {
    assert.equal(
      row.metadata?.source_entry_id,
      'folo-entry-1',
      'upstream entry id preserved in metadata'
    );
    assert.ok(row.id.startsWith('url-'), 'storage id should be URL-derived');
  }
  assert.notEqual(xinzhiyuanRows.items[0].id, xinzhiyuanRows.items[1].id);

  const crossAdapterAdded = await store.saveSourceDataBatch(
    [
      {
        id: 'rss-guid-xyz',
        title: 'Cross adapter same article',
        url: 'https://example.com/old?__biz=A&mid=1',
        description: 'rss copy',
        published_date: '2026-05-14T05:05:00.000Z',
        source: '新智元',
        category: 'rss'
      }
    ],
    '2026-05-25',
    'RSSAdapter'
  );
  assert.equal(crossAdapterAdded, 0, 'cross-adapter dedup should hit by URL');
  assert.equal((await store.listSourceData({ source: '新智元' })).total, 2);

  await store.saveSourceData(
    {
      id: 'no-url-1',
      title: 'No url item',
      url: '',
      description: '',
      published_date: '2026-05-20',
      source: 'manual',
      category: 'note'
    },
    '2026-05-20',
    'manual'
  );
  const noUrlAgain = await store.saveSourceDataBatch(
    [
      {
        id: 'no-url-1',
        title: 'No url item duplicate attempt',
        url: '',
        description: '',
        published_date: '2026-05-21',
        source: 'manual',
        category: 'note'
      }
    ],
    '2026-05-21',
    'manual'
  );
  assert.equal(noUrlAgain, 0);
  assert.ok(await store.getSourceData('no-url-1'));

  await store.saveKBCategory({ id: 'kb-cat', name: 'KB', updatedAt: Date.now() });
  await store.saveKBDocument({
    id: 'kb-doc',
    categoryId: 'kb-cat',
    name: 'Doc',
    fileName: 'doc.md',
    type: 'markdown',
    chunkCount: 1,
    metadata: {},
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
  await store.saveKBChunk({
    id: 'kb-chunk',
    documentId: 'kb-doc',
    content: 'knowledge smoke searchable',
    index: 0
  });
  assert.equal((await store.searchKBChunks('knowledge')).length, 1);

  await store.saveMemoryCategory({ id: 'mem-cat', name: 'Memory', updatedAt: Date.now() });
  await store.saveMemory({
    id: 'mem-a',
    categoryId: 'mem-cat',
    content: 'memory smoke searchable',
    importance: 3,
    tags: ['smoke']
  });
  assert.equal((await store.searchMemories('memory')).length, 1);

  await store.saveApiKey({
    id: 'key-a',
    name: 'Key A',
    keyHash: 'hash-a',
    prefix: 'sk_pf_ab',
    sourceFingerprint: 'fingerprint-a',
    verificationToken: 'token-a',
    status: 'pending'
  });
  assert.equal((await store.getApiKeyByVerificationToken('token-a')).id, 'key-a');
  await store.updateApiKeyStatus('key-a', 'active');
  await store.updateApiKeyLastUsed('key-a');
  assert.equal((await store.getApiKeyByFingerprint('fingerprint-a')).status, 'active');
  assert.equal((await store.getApiKeysByPrefix('sk_pf_ab')).length, 1);

  console.log('Repository smoke tests passed.');
} finally {
  await store.close();
}
