import assert from 'node:assert/strict';
import { AppError } from '../dist/api/http.js';
import { ContentRouteService } from '../dist/services/api/ContentRouteService.js';
import { DashboardRouteService } from '../dist/services/api/DashboardRouteService.js';
import { PublishingRouteService } from '../dist/services/api/PublishingRouteService.js';
import { SettingsRouteService } from '../dist/services/api/SettingsRouteService.js';
import { McpRouteService } from '../dist/services/api/McpRouteService.js';
import { ScheduleRouteService } from '../dist/services/api/ScheduleRouteService.js';
import { initRegistries } from '../dist/registries/PluginInit.js';

async function assertRejectsAppError(fn, statusCode) {
  try {
    await fn();
    assert.fail(`Expected AppError ${statusCode}`);
  } catch (error) {
    assert.equal(error instanceof AppError, true);
    assert.equal(error.statusCode, statusCode);
  }
}

async function testSettingsRouteService() {
  let savedSettings;
  let reloadCount = 0;
  const store = {
    async get() {
      return { CLOSED_PLUGINS: [], ADAPTERS: [], PUBLISHERS: [], STORAGES: [], AI_PROVIDERS: [], CATEGORIES: [] };
    },
    async put(_key, value) {
      savedSettings = value;
    }
  };
  const context = {
    async reload() {
      reloadCount++;
    },
    pluginMetadataService: { listAll: () => ({}) },
    interopService: {}
  };
  const service = new SettingsRouteService(store, context);
  const result = await service.saveSettings({ SELECTION_FETCH_DAYS: '5' });
  assert.deepEqual(result, { status: 'success' });
  assert.equal(savedSettings.SELECTION_FETCH_DAYS, 5);
  assert.equal(reloadCount, 1);

  const failingService = new SettingsRouteService(store, {
    ...context,
    async reload() {
      throw new Error('reload failed');
    }
  });
  await assert.rejects(() => failingService.saveSettings({ SELECTION_FETCH_DAYS: '6' }), /reload failed/);
}

async function testPublishingRouteService() {
  const baseContext = {
    publisherInstances: [],
    taskService: {
      async publish(id, content, options) {
        return { id, content, options };
      }
    }
  };

  const missingStore = { async getCommitHistoryById() { return null; } };
  await assertRejectsAppError(() => new PublishingRouteService(missingStore, baseContext).republish('1'), 404);

  const recordStore = {
    async getCommitHistoryById() {
      return { platform: 'github', commitMessage: 'msg', filePath: 'p.md', date: '2026-05-19', fullContent: 'body' };
    }
  };
  await assertRejectsAppError(() => new PublishingRouteService(recordStore, baseContext).republish('1'), 400);

  const context = {
    ...baseContext,
    publisherInstances: [{ id: 'github', name: 'GitHub' }]
  };
  const result = await new PublishingRouteService(recordStore, context).republish('1');
  assert.equal(result.status, 'success');
  assert.equal(result.data.id, 'github');
}

async function testContentRouteService() {
  let settings = { ADAPTERS: [], PUBLISHERS: [], STORAGES: [], AI_PROVIDERS: [], CLOSED_PLUGINS: [], CATEGORIES: [] };
  let reloadCount = 0;
  const store = {
    async get() {
      return settings;
    },
    async put(_key, value) {
      settings = value;
    }
  };
  const context = {
    async reload() {
      reloadCount++;
    }
  };
  const service = new ContentRouteService(store, context);

  await assertRejectsAppError(() => service.importOpml(undefined), 400);
  await assertRejectsAppError(() => service.readTempImage(undefined), 400);
  await assertRejectsAppError(() => service.fetchProxyImage(undefined), 400);
  const mediaService = new ContentRouteService(store, {
    ...context,
    mediaProxyService: {
      async readTempImage() {
        return { statusCode: 403, error: 'Forbidden' };
      },
      async fetchImage() {
        return { statusCode: 502, error: 'Bad Gateway' };
      }
    }
  });
  await assertRejectsAppError(() => mediaService.readTempImage('/tmp/a.jpg'), 403);
  await assertRejectsAppError(() => mediaService.fetchProxyImage('https://example.com/a.jpg'), 502);

  const opml = `<?xml version="1.0"?><opml version="2.0"><body><outline text="A" title="A" type="rss" xmlUrl="https://example.com/rss.xml"/></body></opml>`;
  const first = await service.importOpml(opml);
  const second = await service.importOpml(opml);
  assert.equal(first.count, 1);
  assert.equal(first.added, 1);
  assert.equal(second.added, 1);
  assert.equal(settings.ADAPTERS[0].items.length, 1);
  assert.equal(reloadCount, 2);
}

async function testMcpRouteService() {
  const agents = [
    { id: 'agent-a', mcpServerIds: ['mcp-a', 'mcp-b'] },
    { id: 'agent-b', mcpServerIds: ['mcp-b'] }
  ];
  const savedAgents = [];
  const store = {
    async deleteMCPConfig(id) {
      assert.equal(id, 'mcp-a');
    },
    async listAgents() {
      return agents;
    },
    async saveAgent(agent) {
      savedAgents.push({ ...agent });
    }
  };
  let reloadCount = 0;
  const service = new McpRouteService(store, { async reload() { reloadCount++; } });
  const result = await service.deleteConfig('mcp-a');
  assert.deepEqual(result, { status: 'success' });
  assert.equal(savedAgents.length, 1);
  assert.deepEqual(savedAgents[0].mcpServerIds, ['mcp-b']);
  assert.equal(reloadCount, 1);
}

async function testScheduleRouteService() {
  const service = new ScheduleRouteService(
    { async getSchedule() { return null; } },
    { schedulerService: { runNow() { throw new Error('should not run'); } } }
  );
  await assertRejectsAppError(() => service.runNow('missing'), 404);
}

async function testDashboardRouteService() {
  const service = new DashboardRouteService({ settings: {} });
  await assertRejectsAppError(() => service.listModels({ type: 'UNKNOWN' }), 400);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ data: [{ id: 'mock-model' }] }), { status: 200 });
  try {
    const models = await service.listModels({ type: 'OPENAI', apiUrl: 'http://localhost:1', apiKey: 'test', models: ['mock-model'] });
    assert.deepEqual(models, ['mock-model']);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

await initRegistries();
await testSettingsRouteService();
await testPublishingRouteService();
await testContentRouteService();
await testDashboardRouteService();
await testMcpRouteService();
await testScheduleRouteService();

console.log('Route service smoke tests passed.');
