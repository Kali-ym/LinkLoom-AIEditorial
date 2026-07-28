import { describe, expect, it } from 'vitest';
import { registerBuiltinSteps, StepCatalog } from '../src/services/agents/steps/index.js';

registerBuiltinSteps();
const catalog = StepCatalog.getInstance();

describe('StepCatalog', () => {
  it('registers the stable workflow step types and excludes LangGraph stub', () => {
    const types = catalog
      .list()
      .map((d) => d.type)
      .sort();
    expect(types).toEqual(
      [
        'adapter',
        'agent',
        'batch-iterate',
        'human-approval',
        'kv-read',
        'kv-write',
        'router',
        'store-query',
        'store-write',
        'tool',
        'transform',
        'workflow'
      ].sort()
    );
    expect(types).not.toContain('langgraph');
  });

  it('store-query does not expose filter.sourceType field', () => {
    const storeQueryDef = catalog.get('store-query');
    const sourceTypeField = storeQueryDef.configSchema.fields.find(
      (f) => f.key === 'filter.sourceType'
    );
    expect(sourceTypeField).toBeUndefined();
  });

  it('store-write uses generic metadata write defaults', () => {
    const storeWriteDef = catalog.get('store-write');
    const allowedKeysField = storeWriteDef.configSchema.fields.find((f) => f.key === 'allowedKeys');
    const stampField = storeWriteDef.configSchema.fields.find((f) => f.key === 'stamp');
    expect(allowedKeysField!.type).toBe('json');
    expect(allowedKeysField!.options).toBeUndefined();
    expect(allowedKeysField!.default).toEqual([]);
    expect(stampField!.default).toBeNull();
    expect(storeWriteDef.defaultConfig).toMatchObject({ allowedKeys: [], stamp: null });
  });

  it('kv-write uses generic KV write defaults', () => {
    const kvWriteDef = catalog.get('kv-write');
    expect(kvWriteDef.defaultConfig).toMatchObject({
      key: '',
      value: '$.current',
      indexKey: '',
      indexValue: ''
    });
    const serialized = JSON.stringify({
      defaultConfig: kvWriteDef.defaultConfig,
      configSchema: kvWriteDef.configSchema
    });
    expect(serialized).not.toContain('daily_digest');
  });

  it('classifies pipeline vs classic steps correctly', () => {
    const pipelineTypes = catalog
      .list()
      .filter((d) => d.category === 'pipeline')
      .map((d) => d.type)
      .sort();
    const classicTypes = catalog
      .list()
      .filter((d) => d.category === 'classic')
      .map((d) => d.type)
      .sort();
    expect(pipelineTypes).toEqual([
      'adapter',
      'batch-iterate',
      'human-approval',
      'kv-read',
      'kv-write',
      'router',
      'store-query',
      'store-write',
      'transform'
    ]);
    expect(classicTypes).toEqual(['agent', 'tool', 'workflow']);
  });

  it('all pipeline steps have executor + configSchema + defaultConfig', () => {
    for (const def of catalog.list().filter((d) => d.category === 'pipeline')) {
      expect(def.executor, `${def.type} should have executor`).toBeTruthy();
      expect(
        def.configSchema?.fields?.length,
        `${def.type} should have configSchema`
      ).toBeGreaterThan(0);
      expect(def.defaultConfig, `${def.type} should have defaultConfig`).toBeTruthy();
    }
  });

  it('classic steps do not have executor', () => {
    for (const def of catalog.list().filter((d) => d.category === 'classic')) {
      expect(def.executor, `${def.type} should NOT have executor`).toBeFalsy();
    }
  });
});
