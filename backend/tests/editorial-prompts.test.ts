import { describe, expect, it } from 'vitest';
import { EDITORIAL_PROMPTS } from '../src/services/editorial/editorialPrompts.js';
import { scanFragmentRefs } from '../src/services/agents/prompt/registry/templateEngine.js';

describe('editorial application-layer prompts structure (base+app split)', () => {
  it('topic_copilot has role + identity + capabilities + constraints + outputFormat', () => {
    const prompt = EDITORIAL_PROMPTS.topic_copilot;
    expect(prompt.role).toBeTruthy();
    expect(prompt.identity).toBeTruthy();
    expect(prompt.capabilities).toBeTruthy();
    expect(prompt.constraints).toBeTruthy();
    expect(prompt.outputFormat).toBeTruthy();
  });

  it('application layer does NOT reference shared fragments (base provides them)', () => {
    for (const [id, prompt] of Object.entries(EDITORIAL_PROMPTS)) {
      const fields = [prompt.capabilities, prompt.constraints, prompt.outputFormat, prompt.identity].filter(
        Boolean
      ) as string[];
      for (const field of fields) {
        const refs = scanFragmentRefs(field);
        expect(refs, `${id} should not reference fragments (base layer provides them)`).toEqual([]);
      }
    }
  });

  it('topic_copilot capabilities lists its dedicated tools', () => {
    const caps = EDITORIAL_PROMPTS.topic_copilot.capabilities ?? '';
    expect(caps).toContain('query_data');
    expect(caps).toContain('query_knowledge');
    expect(caps).toContain('web_search');
    expect(caps).toContain('base');
  });

  it('topic_copilot defines angle evaluation four dimensions', () => {
    const c = EDITORIAL_PROMPTS.topic_copilot.constraints ?? '';
    expect(c).toContain('新颖性');
    expect(c).toContain('时效性');
    expect(c).toContain('读者价值');
    expect(c).toContain('可成稿性');
  });
});
