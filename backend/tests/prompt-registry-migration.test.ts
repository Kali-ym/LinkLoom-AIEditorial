import { describe, expect, it } from 'vitest';
import { PromptRegistry } from '../src/services/agents/prompt/registry/PromptRegistry.js';
import { PromptService } from '../src/services/PromptService.js';
import { EDITORIAL_PROMPTS } from '../src/services/editorial/editorialPrompts.js';
import { loadPromptAssetsFromDir } from '../src/services/agents/prompt/registry/FragmentLoader.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const promptsDir = path.join(__dirname, '..', 'src', 'prompts');

async function makeLoadedRegistry(): Promise<PromptRegistry> {
  const reg = new (class extends PromptRegistry {})();
  const assets = await loadPromptAssetsFromDir(promptsDir);
  for (const frag of assets.fragments) reg.registerFragment(frag);
  for (const tpl of assets.templates) reg.registerTemplate(tpl);
  return reg;
}

describe('PromptRegistry structured prompt registry', () => {
  it('registerStructuredPrompt / getStructuredPrompt round-trip', () => {
    const reg = new (class extends PromptRegistry {})();
    reg.registerStructuredPrompt('topic_copilot', EDITORIAL_PROMPTS.topic_copilot);
    const got = reg.getStructuredPrompt('topic_copilot');
    expect(got).toBeDefined();
    expect(got?.role).toContain('选题 Copilot');
    expect(reg.getStructuredPrompt('nonexistent')).toBeUndefined();
  });

  it('listStructuredPromptIds returns registered ids', () => {
    const reg = new (class extends PromptRegistry {})();
    reg.registerStructuredPrompt('a', { role: 'a' });
    reg.registerStructuredPrompt('b', { role: 'b' });
    expect(reg.listStructuredPromptIds().sort()).toEqual(['a', 'b']);
  });
});

describe('PromptService backward compatibility (11 call sites)', () => {
  it('getPrompt returns rendered template string with variables', async () => {
    const svc = PromptService.getInstance();
    // 确保 registry 已加载真实 prompts 目录
    await svc.loadTemplates();
    const out = svc.getPrompt('translation', { targetLang: 'Japanese', text: 'hello' });
    expect(out).toContain('Japanese');
    expect(out).toContain('hello');
  });

  it('getPrompt returns empty string for missing template', async () => {
    const svc = PromptService.getInstance();
    await svc.loadTemplates();
    expect(svc.getPrompt('nonexistent_template_xyz')).toBe('');
  });

  it('getRegistry exposes the underlying PromptRegistry', () => {
    const svc = PromptService.getInstance();
    expect(svc.getRegistry()).toBeInstanceOf(PromptRegistry);
  });

  it('ai_search template renders with keyword variable', async () => {
    const svc = PromptService.getInstance();
    await svc.loadTemplates();
    const out = svc.getPrompt('ai_search', { keyword: 'GPT-5 release' });
    expect(out).toContain('GPT-5 release');
    expect(out).toContain('JSON');
  });
});

describe('structuredPromptRef resolution path (used by WorkflowTemplateRouteService)', () => {
  it('registry.getStructuredPrompt returns object usable as systemPrompt', async () => {
    const reg = await makeLoadedRegistry();
    reg.registerStructuredPrompt('topic_copilot', EDITORIAL_PROMPTS.topic_copilot);
    const structured = reg.getStructuredPrompt('topic_copilot');
    expect(structured).toBeDefined();
    // 模拟 WorkflowTemplateRouteService 的赋值:systemPrompt = structured
    const agentDef = { systemPrompt: structured };
    expect(typeof agentDef.systemPrompt).toBe('object');
    expect(agentDef.systemPrompt).toHaveProperty('role');
    expect(agentDef.systemPrompt).toHaveProperty('constraints');
  });
});

describe('fragment expansion is available through PromptService', () => {
  it('templates containing {{#fragment:xxx}} get expanded via getPrompt', async () => {
    const svc = PromptService.getInstance();
    await svc.loadTemplates();
    const reg = svc.getRegistry();
    // 注册一个引用 fragment 的临时模板
    reg.registerTemplate({
      name: '__test_frag_ref',
      body: 'pre {{#fragment:tool_calling}} post'
    });
    const out = svc.getPrompt('__test_frag_ref');
    expect(out).toContain('工具调用纪律');
    expect(out).not.toContain('{{#fragment:tool_calling}}');
  });
});
