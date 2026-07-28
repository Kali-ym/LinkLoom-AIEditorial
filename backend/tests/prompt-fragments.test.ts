import { describe, expect, it } from 'vitest';
import { loadPromptAssetsFromDir } from '../src/services/agents/prompt/registry/FragmentLoader.js';
import { PromptRegistry } from '../src/services/agents/prompt/registry/PromptRegistry.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const promptsDir = path.join(__dirname, '..', 'src', 'prompts');

describe('agent-common.md fragments', () => {
  it('loads all 7 shared fragments with expected ids', async () => {
    const assets = await loadPromptAssetsFromDir(promptsDir);
    const ids = assets.fragments.map((f) => f.id).sort();
    expect(ids).toEqual(
      [
        'fact_safety',
        'formatting',
        'output_efficiency',
        'react_loop',
        'task_completion',
        'tool_calling',
        'tool_catalog'
      ].sort()
    );
  });

  it('each fragment has non-empty body', async () => {
    const assets = await loadPromptAssetsFromDir(promptsDir);
    for (const frag of assets.fragments) {
      expect(frag.body.length).toBeGreaterThan(20);
      expect(frag.body.trim()).not.toBe('');
    }
  });

  it('tool_catalog references tool_calling fragment', async () => {
    const assets = await loadPromptAssetsFromDir(promptsDir);
    const catalog = assets.fragments.find((f) => f.id === 'tool_catalog');
    expect(catalog?.body).toContain('{{#fragment:tool_calling}}');
  });

  it('registry expands cross-fragment reference in tool_catalog', async () => {
    const reg = new (class extends PromptRegistry {})();
    const assets = await loadPromptAssetsFromDir(promptsDir);
    for (const frag of assets.fragments) reg.registerFragment(frag);
    const raw = reg.getFragmentRaw('tool_catalog');
    expect(raw).toContain('{{#fragment:tool_calling}}');
    const rendered = reg.renderString(raw || '');
    expect(rendered.text).not.toContain('{{#fragment:tool_calling}}');
    expect(rendered.text).toContain('工具调用纪律');
    expect(rendered.usedFragments).toContain('tool_calling');
  });

  it('legacy common.md templates still load (translation, ai_search, rss_generation)', async () => {
    const assets = await loadPromptAssetsFromDir(promptsDir);
    const names = assets.templates.map((t) => t.name);
    expect(names).toContain('translation');
    expect(names).toContain('ai_search');
    expect(names).toContain('rss_generation');
  });
});
