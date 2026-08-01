import { describe, expect, it } from 'vitest';
import { IdentityProvider } from '../src/services/agents/prompt/providers/IdentityProvider.js';
import { RoleProvider } from '../src/services/agents/prompt/providers/RoleProvider.js';
import type { PromptBuildContext } from '../src/services/agents/prompt/types.js';

function makeCtx(overrides: Partial<PromptBuildContext> = {}): PromptBuildContext {
  return {
    agentDef: {
      id: 'a',
      name: 'A',
      description: '',
      systemPrompt: '',
      providerId: 'OPENAI',
      model: 'gpt-4o',
      temperature: 0,
      toolIds: [],
      skillIds: [],
      mcpServerIds: []
    } as never,
    structuredPrompt: {},
    tools: [],
    skills: [],
    mcpTools: [],
    providerId: 'OPENAI',
    model: 'gpt-4o',
    variables: {},
    ...overrides
  };
}

describe('RoleProvider', () => {
  it('wraps role in <role> tag', () => {
    const p = new RoleProvider();
    const r = p.build(makeCtx({ structuredPrompt: { role: '你是 Copilot' } }));
    expect(r?.content).toBe('<role>你是 Copilot</role>');
  });
  it('returns null when no role', () => {
    const p = new RoleProvider();
    expect(p.build(makeCtx({ structuredPrompt: {} }))).toBeNull();
  });
  it('returns null for whitespace-only role', () => {
    const p = new RoleProvider();
    expect(p.build(makeCtx({ structuredPrompt: { role: '   ' } }))).toBeNull();
  });
  it('sanitizes role content', () => {
    const p = new RoleProvider();
    const r = p.build(makeCtx({ structuredPrompt: { role: 'a<b' } }));
    expect(r?.content).toBe('<role>a&lt;b</role>');
  });
  it('has id role, phase system_accumulate, priority 10', () => {
    const p = new RoleProvider();
    expect(p.id).toBe('role');
    expect(p.phase).toBe('system_accumulate');
    expect(p.priority).toBe(10);
  });
});

describe('IdentityProvider', () => {
  it('wraps string identity in <identity> tag', () => {
    const p = new IdentityProvider();
    const r = p.build(makeCtx({ structuredPrompt: { identity: '详细人设' } }));
    expect(r?.content).toBe('<identity>详细人设</identity>');
  });
  it('returns null when no identity', () => {
    const p = new IdentityProvider();
    expect(p.build(makeCtx({ structuredPrompt: {} }))).toBeNull();
  });
  it('returns null for whitespace-only identity', () => {
    const p = new IdentityProvider();
    expect(p.build(makeCtx({ structuredPrompt: { identity: '   ' } }))).toBeNull();
  });
  it('sanitizes identity content', () => {
    const p = new IdentityProvider();
    const r = p.build(makeCtx({ structuredPrompt: { identity: 'a<b' } }));
    expect(r?.content).toBe('<identity>a&lt;b</identity>');
  });
  it('returns null for docRef identity (本轮未实现解析)', () => {
    const p = new IdentityProvider();
    const r = p.build(makeCtx({ structuredPrompt: { identity: { docRef: 'p.md' } } }));
    expect(r).toBeNull();
  });
  it('has id identity, phase system_accumulate, priority 20', () => {
    const p = new IdentityProvider();
    expect(p.id).toBe('identity');
    expect(p.phase).toBe('system_accumulate');
    expect(p.priority).toBe(20);
  });
});

import { CapabilitiesProvider } from '../src/services/agents/prompt/providers/CapabilitiesProvider.js';
import { ConstraintsProvider } from '../src/services/agents/prompt/providers/ConstraintsProvider.js';
import { OutputFormatProvider } from '../src/services/agents/prompt/providers/OutputFormatProvider.js';

describe('CapabilitiesProvider', () => {
  it('wraps capabilities in <capabilities> tag', () => {
    const p = new CapabilitiesProvider();
    const r = p.build(makeCtx({ structuredPrompt: { capabilities: '可查询素材' } }));
    expect(r?.content).toBe('<capabilities>可查询素材</capabilities>');
  });
  it('returns null when no capabilities', () => {
    expect(new CapabilitiesProvider().build(makeCtx({}))).toBeNull();
  });
  it('returns null for whitespace-only capabilities', () => {
    expect(
      new CapabilitiesProvider().build(makeCtx({ structuredPrompt: { capabilities: '  ' } }))
    ).toBeNull();
  });
  it('sanitizes capabilities content', () => {
    const r = new CapabilitiesProvider().build(
      makeCtx({ structuredPrompt: { capabilities: 'a<b&c' } })
    );
    expect(r?.content).toBe('<capabilities>a&lt;b&amp;c</capabilities>');
  });
  it('has id capabilities, phase system_accumulate, priority 30', () => {
    const p = new CapabilitiesProvider();
    expect(p.id).toBe('capabilities');
    expect(p.phase).toBe('system_accumulate');
    expect(p.priority).toBe(30);
  });
});

describe('ConstraintsProvider', () => {
  it('wraps constraints in <constraints> tag', () => {
    const p = new ConstraintsProvider();
    const r = p.build(makeCtx({ structuredPrompt: { constraints: '不编造' } }));
    expect(r?.content).toBe('<constraints>不编造</constraints>');
  });
  it('returns null when no constraints', () => {
    expect(new ConstraintsProvider().build(makeCtx({}))).toBeNull();
  });
  it('has id constraints, phase system_accumulate, priority 40', () => {
    const p = new ConstraintsProvider();
    expect(p.id).toBe('constraints');
    expect(p.phase).toBe('system_accumulate');
    expect(p.priority).toBe(40);
  });
});

describe('OutputFormatProvider', () => {
  it('wraps outputFormat in <output_format> tag', () => {
    const p = new OutputFormatProvider();
    const r = p.build(makeCtx({ structuredPrompt: { outputFormat: 'JSON' } }));
    expect(r?.content).toBe('<output_format>JSON</output_format>');
  });
  it('returns null when no outputFormat', () => {
    expect(new OutputFormatProvider().build(makeCtx({}))).toBeNull();
  });
  it('has id output_format, phase system_accumulate, priority 50', () => {
    const p = new OutputFormatProvider();
    expect(p.id).toBe('output_format');
    expect(p.phase).toBe('system_accumulate');
    expect(p.priority).toBe(50);
  });
});

import { ExamplesProvider } from '../src/services/agents/prompt/providers/ExamplesProvider.js';

describe('ExamplesProvider', () => {
  it('builds <examples> with input/output pairs', () => {
    const p = new ExamplesProvider();
    const r = p.build(
      makeCtx({
        structuredPrompt: {
          examples: [
            { input: '帮我选题', output: '1. 角度A...' },
            { input: '改写', output: '改写后...' }
          ]
        }
      })
    );
    expect(r?.content).toBe(
      '<examples>\n<example>\n<input>帮我选题</input>\n<output>1. 角度A...</output>\n</example>\n' +
        '<example>\n<input>改写</input>\n<output>改写后...</output>\n</example>\n</examples>'
    );
  });
  it('returns null when no examples', () => {
    expect(new ExamplesProvider().build(makeCtx({}))).toBeNull();
  });
  it('returns null when empty examples', () => {
    expect(
      new ExamplesProvider().build(makeCtx({ structuredPrompt: { examples: [] } }))
    ).toBeNull();
  });
  it('sanitizes example content', () => {
    const p = new ExamplesProvider();
    const r = p.build(
      makeCtx({ structuredPrompt: { examples: [{ input: 'a<b', output: 'c' }] } })
    );
    expect(r?.content).toContain('<input>a&lt;b</input>');
  });
  it('has id examples, phase system_accumulate, priority 60', () => {
    const p = new ExamplesProvider();
    expect(p.id).toBe('examples');
    expect(p.phase).toBe('system_accumulate');
    expect(p.priority).toBe(60);
  });
});

import { SkillProvider } from '../src/services/agents/prompt/providers/SkillProvider.js';

describe('SkillProvider', () => {
  function agentWithSkills(skillIds: string[]): PromptBuildContext['agentDef'] {
    return {
      id: 'a',
      name: 'A',
      description: '',
      systemPrompt: '',
      providerId: 'OPENAI',
      model: 'gpt-4o',
      temperature: 0,
      toolIds: [],
      skillIds,
      mcpServerIds: []
    } as never;
  }

  it('wraps skill metadata in <available_skills>', () => {
    const fakeSkillService = {
      listSkillMetadata: (ids?: string[]) =>
        (ids ?? []).map((id) => ({ id, name: `Skill ${id}`, description: 'desc' }))
    };
    const p = new SkillProvider(fakeSkillService);
    const r = p.build(makeCtx({ agentDef: agentWithSkills(['skill_x']) }));
    expect(r?.content).toContain('<available_skills>');
    expect(r?.content).toContain('skill_x');
    expect(r?.content).toContain('Description: desc');
    expect(r?.content).not.toContain('Instructions');
  });
  it('prefers ctx.skillMetadata over skillService', () => {
    const fakeSkillService = {
      listSkillMetadata: () => [{ id: 'from-service', name: 'From Service', description: 'svc' }]
    };
    const p = new SkillProvider(fakeSkillService);
    const r = p.build(
      makeCtx({
        agentDef: agentWithSkills(['s1']),
        skillMetadata: [{ id: 'pre', name: 'Pre', description: 'gen' }]
      })
    );
    expect(r?.content).toContain('pre');
    expect(r?.content).not.toContain('from-service');
  });
  it('returns null when no skillIds', () => {
    const p = new SkillProvider({ listSkillMetadata: () => [] });
    expect(p.build(makeCtx({}))).toBeNull();
  });
  it('returns null when skillService returns empty metadata', () => {
    const p = new SkillProvider({ listSkillMetadata: () => [] });
    const r = p.build(makeCtx({ agentDef: agentWithSkills(['x']) }));
    expect(r).toBeNull();
  });
  it('returns null when skillMetadata is empty and service returns empty', () => {
    const p = new SkillProvider({ listSkillMetadata: () => [] });
    const r = p.build(makeCtx({ agentDef: agentWithSkills(['x']), skillMetadata: [] }));
    expect(r).toBeNull();
  });
  it('has id skill, phase variant_accumulate, priority 70', () => {
    const p = new SkillProvider({} as never);
    expect(p.id).toBe('skill');
    expect(p.phase).toBe('variant_accumulate');
    expect(p.priority).toBe(70);
  });

  it('renders only skill metadata and never instructions or filesystem paths', () => {
    const provider = new SkillProvider({
      listSkillMetadata: () => [
        { id: 'skill-a', name: 'Skill A', description: 'desc' },
      ],
    });

    const result = provider.build({
      agentDef: { skillIds: ['skill-a'] } as never,
    } as never);

    expect(result?.content).toContain('skill-a');
    expect(result?.content).toContain('desc');
    expect(result?.content).not.toContain('Instructions');
    expect(result?.content).not.toContain('dirPath');
  });
});

import { ModelHintProvider } from '../src/services/agents/prompt/providers/ModelHintProvider.js';

describe('ModelHintProvider', () => {
  it('injects modelHints for current providerId (大写枚举)', () => {
    const p = new ModelHintProvider();
    const r = p.build(
      makeCtx({
        providerId: 'GEMINI',
        structuredPrompt: { modelHints: { GEMINI: '你可使用 google_search', OPENAI: '另' } }
      })
    );
    expect(r?.content).toBe('<model_hint>你可使用 google_search</model_hint>');
  });
  it('does not inject a search hint when web search is disabled', () => {
    const p = new ModelHintProvider();
    const r = p.build(
      makeCtx({
        providerId: 'GEMINI',
        webSearchPolicy: {
          effectiveMode: 'off',
          injectToolIds: [],
          stripToolIds: ['web_search'],
          enableProviderBuiltinSearch: false,
          degradedFromProvider: false
        }
      })
    );
    expect(r).toBeNull();
  });
  it('injects app-mode hint for web_search', () => {
    const p = new ModelHintProvider();
    const r = p.build(
      makeCtx({
        providerId: 'OPENAI',
        webSearchPolicy: {
          effectiveMode: 'app',
          injectToolIds: ['web_search'],
          stripToolIds: [],
          enableProviderBuiltinSearch: false,
          degradedFromProvider: false
        }
      })
    );
    expect(r?.content).toContain('实时外部信息');
  });
  it('injects provider-mode hint for google_search', () => {
    const p = new ModelHintProvider();
    const r = p.build(
      makeCtx({
        providerId: 'GEMINI',
        webSearchPolicy: {
          effectiveMode: 'provider',
          injectToolIds: ['crawl_single_page'],
          stripToolIds: ['web_search'],
          enableProviderBuiltinSearch: true,
          degradedFromProvider: false
        }
      })
    );
    expect(r?.content).toContain('内置搜索');
  });
  it('injects built-in Claude thinking hint when CLAUDE provider and reasoningEffort set', () => {
    const p = new ModelHintProvider();
    const r = p.build(
      makeCtx({
        providerId: 'CLAUDE',
        providerConfig: { type: 'CLAUDE', reasoningEffort: 'high' } as never
      })
    );
    expect(r?.content).toContain('扩展思考');
  });
  it('does NOT inject Claude thinking hint when reasoningEffort absent', () => {
    const p = new ModelHintProvider();
    const r = p.build(
      makeCtx({
        providerId: 'CLAUDE',
        providerConfig: { type: 'CLAUDE' } as never
      })
    );
    expect(r).toBeNull();
  });
  it('does NOT inject Claude thinking hint when reasoningEffort is none', () => {
    const p = new ModelHintProvider();
    const r = p.build(
      makeCtx({
        providerId: 'CLAUDE',
        providerConfig: { type: 'CLAUDE', reasoningEffort: 'none' } as never
      })
    );
    expect(r).toBeNull();
  });
  it('returns null when no hints for provider', () => {
    const p = new ModelHintProvider();
    expect(
      p.build(
        makeCtx({ providerId: 'OPENAI', structuredPrompt: { modelHints: { GEMINI: 'x' } } })
      )
    ).toBeNull();
  });
  it('combines custom hint + built-in hint', () => {
    const p = new ModelHintProvider();
    const r = p.build(
      makeCtx({
        providerId: 'GEMINI',
        structuredPrompt: { modelHints: { GEMINI: '自定义提示' } },
        webSearchPolicy: {
          effectiveMode: 'provider',
          injectToolIds: ['crawl_single_page'],
          stripToolIds: ['web_search'],
          enableProviderBuiltinSearch: true,
          degradedFromProvider: false
        }
      })
    );
    expect(r?.content).toContain('自定义提示');
    expect(r?.content).toContain('内置搜索');
  });
  it('has id model_hint, phase variant_accumulate, priority 5', () => {
    const p = new ModelHintProvider();
    expect(p.id).toBe('model_hint');
    expect(p.phase).toBe('variant_accumulate');
    expect(p.priority).toBe(5);
  });
});

import { ToolSystemProvider } from '../src/services/agents/prompt/providers/ToolSystemProvider.js';

describe('ToolSystemProvider', () => {
  it('injects tool descriptions when !isCanUseFC', () => {
    const p = new ToolSystemProvider();
    const r = p.build(
      makeCtx({
        providerId: 'OLLAMA',
        model: 'llama2',
        tools: [
          { id: 't1', name: 'search', description: '搜索', parameters: {} } as never,
          { id: 't2', name: 'crawl', description: '抓取', parameters: {} } as never
        ]
      })
    );
    expect(r?.content).toContain('<tools');
    expect(r?.content).toContain('<tool name="search">搜索</tool>');
    expect(r?.content).toContain('<tool name="crawl">抓取</tool>');
  });
  it('includes mcpTools in the injected list', () => {
    const p = new ToolSystemProvider();
    const r = p.build(
      makeCtx({
        providerId: 'OLLAMA',
        model: 'llama2',
        tools: [],
        mcpTools: [
          { id: 'm1', name: 'mcp_tool', description: 'MCP 工具', parameters: {} } as never
        ]
      })
    );
    expect(r?.content).toContain('<tool name="mcp_tool">MCP 工具</tool>');
  });
  it('returns null when model supports FC', () => {
    const p = new ToolSystemProvider();
    const r = p.build(
      makeCtx({
        providerId: 'OPENAI',
        model: 'gpt-4o',
        tools: [{ id: 't', name: 'search', description: 's', parameters: {} } as never]
      })
    );
    expect(r).toBeNull();
  });
  it('returns null for OLLAMA llama3.1 (FC-capable after table fix)', () => {
    const p = new ToolSystemProvider();
    const r = p.build(
      makeCtx({
        providerId: 'OLLAMA',
        model: 'llama3.1',
        tools: [{ id: 't', name: 'search', description: 's', parameters: {} } as never]
      })
    );
    expect(r).toBeNull();
  });
  it('returns null for OPENAI o1 (FC-capable reasoning model)', () => {
    const p = new ToolSystemProvider();
    const r = p.build(
      makeCtx({
        providerId: 'OPENAI',
        model: 'o1',
        tools: [{ id: 't', name: 'search', description: 's', parameters: {} } as never]
      })
    );
    expect(r).toBeNull();
  });
  it('returns null when no tools', () => {
    const p = new ToolSystemProvider();
    expect(p.build(makeCtx({ providerId: 'OLLAMA', model: 'llama2', tools: [] }))).toBeNull();
  });
  it('uses "no description" fallback for missing description', () => {
    const p = new ToolSystemProvider();
    const r = p.build(
      makeCtx({
        providerId: 'OLLAMA',
        model: 'llama2',
        tools: [{ id: 't', name: 'nodesc', parameters: {} } as never]
      })
    );
    expect(r?.content).toContain('<tool name="nodesc">no description</tool>');
  });
  it('has id tool_system, phase variant_accumulate, priority 40', () => {
    const p = new ToolSystemProvider();
    expect(p.id).toBe('tool_system');
    expect(p.phase).toBe('variant_accumulate');
    expect(p.priority).toBe(40);
  });
});
