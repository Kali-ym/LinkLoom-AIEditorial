import { describe, expect, it } from 'vitest';
import { parsePromptMarkdown } from '../src/services/agents/prompt/registry/FragmentLoader.js';
import {
  renderTemplate,
  scanFragmentRefs,
  scanVariables
} from '../src/services/agents/prompt/registry/templateEngine.js';
import { PromptRegistry } from '../src/services/agents/prompt/registry/PromptRegistry.js';

describe('FragmentLoader.parsePromptMarkdown', () => {
  it('parses templates via ## [name] headers', () => {
    const md = `## [greet]
Hello {{name}}!

## [bye]
Goodbye {{name}}.`;
    const parsed = parsePromptMarkdown(md, 'test.md');
    expect(parsed.templates).toHaveLength(2);
    expect(parsed.templates[0].name).toBe('greet');
    expect(parsed.templates[0].body).toBe('Hello {{name}}!');
    expect(parsed.templates[1].name).toBe('bye');
    expect(parsed.fragments).toHaveLength(0);
  });

  it('parses fragments via ### fragment: id headers', () => {
    const md = `### fragment: tool_discipline
- Always call tools in parallel when independent
- Never guess tool schemas

### fragment: output_efficiency
Keep output brief.`;
    const parsed = parsePromptMarkdown(md, 'common.md');
    expect(parsed.fragments).toHaveLength(2);
    expect(parsed.fragments[0].id).toBe('tool_discipline');
    expect(parsed.fragments[0].body).toContain('Always call tools in parallel');
    expect(parsed.fragments[1].id).toBe('output_efficiency');
  });

  it('mixes templates and fragments in one file', () => {
    const md = `## [topic_copilot]
You are a topic copilot.
{{#fragment:tool_discipline}}

### fragment: tool_discipline
- Rule A
- Rule B`;
    const parsed = parsePromptMarkdown(md, 'mixed.md');
    expect(parsed.templates).toHaveLength(1);
    expect(parsed.fragments).toHaveLength(1);
    expect(parsed.templates[0].body).toContain('{{#fragment:tool_discipline}}');
  });

  it('returns empty assets for plain text without headers', () => {
    const parsed = parsePromptMarkdown('just some text', 'plain.md');
    expect(parsed.templates).toHaveLength(0);
    expect(parsed.fragments).toHaveLength(0);
  });
});

describe('templateEngine.renderTemplate', () => {
  it('replaces variables via split/join (no $ corruption)', () => {
    const result = renderTemplate('price is {{cost}}', {
      variables: { cost: '$100 USD' }
    });
    expect(result.text).toBe('price is $100 USD');
    expect(result.warnings).toHaveLength(0);
  });

  it('expands fragment references recursively', () => {
    const fragments: Record<string, string> = {
      outer: 'outer start {{#fragment:inner}} outer end',
      inner: 'inner-body'
    };
    const result = renderTemplate(
      'wrap: {{#fragment:outer}}',
      {},
      (id) => fragments[id]
    );
    expect(result.text).toBe('wrap: outer start inner-body outer end');
    expect(result.usedFragments).toEqual(['outer', 'inner']);
  });

  it('warns on missing fragment', () => {
    const result = renderTemplate(
      'use {{#fragment:missing}}',
      { onMissingFragment: 'warn' },
      () => undefined
    );
    expect(result.text).toBe('use {{#fragment:missing}}');
    expect(result.warnings).toContain('fragment not found: missing');
  });

  it('throws on missing fragment when configured', () => {
    expect(() =>
      renderTemplate('use {{#fragment:missing}}', { onMissingFragment: 'throw' }, () => undefined)
    ).toThrow('fragment not found: missing');
  });

  it('respects maxDepth to prevent infinite recursion', () => {
    // 三层独立嵌套:maxDepth=2 时第三层不被展开
    const fragments: Record<string, string> = {
      l1: 'L1[{{#fragment:l2}}]',
      l2: 'L2[{{#fragment:l3}}]',
      l3: 'L3-deep'
    };
    const result = renderTemplate('{{#fragment:l1}}', { maxDepth: 2 }, (id) => fragments[id]);
    expect(result.warnings).toContain('max fragment depth 2 reached, stop expanding');
    // l1(depth0) -> l2(depth1) -> l3(depth2 命中上限,保留占位符)
    expect(result.text).toBe('L1[L2[{{#fragment:l3}}]]');
  });

  it('detects cyclic fragment references (self-reference is cyclic)', () => {
    const fragments: Record<string, string> = {
      a: 'a{{#fragment:b}}',
      b: 'b{{#fragment:a}}'
    };
    const result = renderTemplate('{{#fragment:a}}', { maxDepth: 10 }, (id) => fragments[id]);
    // 出现循环后保留占位符,不抛错
    expect(result.warnings.some((w) => w.includes('cyclic'))).toBe(true);
  });

  it('allows same fragment referenced multiple times in parallel (not cyclic)', () => {
    const fragments: Record<string, string> = {
      common: 'shared-rule',
      agent: 'A uses {{#fragment:common}} and B uses {{#fragment:common}}'
    };
    const result = renderTemplate('{{#fragment:agent}}', { maxDepth: 5 }, (id) => fragments[id]);
    expect(result.text).toBe('A uses shared-rule and B uses shared-rule');
    expect(result.usedFragments).toEqual(['agent', 'common']);
    expect(result.warnings.some((w) => w.includes('cyclic'))).toBe(false);
  });

  it('reports unresolved placeholders as warnings', () => {
    const result = renderTemplate('hi {{unknown}} and {{#fragment:none}}', {});
    expect(result.warnings.some((w) => w.includes('unresolved placeholder: {{unknown}}'))).toBe(
      true
    );
  });
});

describe('templateEngine static analysis', () => {
  it('scanFragmentRefs extracts referenced fragment ids', () => {
    expect(scanFragmentRefs('a {{#fragment:x}} b {{#fragment:y}}')).toEqual(['x', 'y']);
  });

  it('scanVariables extracts variable names', () => {
    expect(scanVariables('{{a}} and {{ b }} but not {{#fragment:c}}')).toEqual(['a', 'b']);
  });
});

describe('PromptRegistry', () => {
  function makeRegistry() {
    // 用唯一子类避开单例,便于并行测试
    return new (class extends PromptRegistry {
      constructor() {
        super();
        // 公开 register* 即可,无需访问私有成员
      }
    })();
  }

  it('resolves fragments via docRef resolver interface', () => {
    const reg = makeRegistry();
    reg.registerFragment({ id: 'safety', body: '- Do not leak secrets' });
    expect(reg.resolve('safety')).toBe('- Do not leak secrets');
    expect(reg.resolve('nonexistent')).toBeUndefined();
  });

  it('renders registered templates with fragment expansion', () => {
    const reg = makeRegistry();
    reg.registerFragment({ id: 'fmt', body: 'Output JSON only.' });
    reg.registerTemplate({
      name: 'reviewer',
      body: 'You are a reviewer.\n{{#fragment:fmt}}\nCheck {{target}}.'
    });
    const result = reg.render('reviewer', { variables: { target: 'numbers' } });
    expect(result.text).toBe('You are a reviewer.\nOutput JSON only.\nCheck numbers.');
    expect(result.usedFragments).toEqual(['fmt']);
  });

  it('getPrompt returns empty string for missing template', () => {
    const reg = makeRegistry();
    expect(reg.getPrompt('nope', { x: '1' })).toBe('');
  });

  it('renderString renders arbitrary text with fragment refs', () => {
    const reg = makeRegistry();
    reg.registerFragment({ id: 'greet', body: 'Hello!' });
    const result = reg.renderString('pre {{#fragment:greet}} post');
    expect(result.text).toBe('pre Hello! post');
  });

  it('analyze reports fragment and variable dependencies', () => {
    const reg = makeRegistry();
    reg.registerTemplate({
      name: 't',
      body: '{{#fragment:a}} uses {{var1}} and {{var2}}'
    });
    const analysis = reg.analyze('t');
    expect(analysis?.fragments).toEqual(['a']);
    expect(analysis?.variables).toEqual(['var1', 'var2']);
  });

  it('falls back to template when fragment id not found but template with same name exists', () => {
    const reg = makeRegistry();
    reg.registerTemplate({ name: 'shared', body: 'shared body' });
    // resolve 先查 fragment,再查 template
    expect(reg.resolve('shared')).toBe('shared body');
  });
});
