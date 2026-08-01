import { describe, expect, it } from 'vitest';
import { TurnContextAssembler } from '../src/services/agents/context/TurnContextAssembler.js';
import { hashString } from '../src/services/agents/engine/canonicalMessageSerializer.js';
import {
  assembleSystemMessages,
  buildPromptPipelineContext
} from '../src/services/agents/prompt/index.js';
import { ModelHintProvider } from '../src/services/agents/prompt/providers/ModelHintProvider.js';
import { ToolSystemProvider } from '../src/services/agents/prompt/providers/ToolSystemProvider.js';
import type { PromptBuildContext } from '../src/services/agents/prompt/types.js';

function makeCtx(overrides: Partial<PromptBuildContext> = {}): PromptBuildContext {
  return {
    agentDef: {
      id: 'a',
      name: 'A',
      description: '',
      systemPrompt: 'You are X',
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

function contributionFrom(
  ctx: PromptBuildContext,
  providerId: string
) {
  return assembleSystemMessages(ctx).contributions?.find(
    (contribution) => contribution.providerId === providerId
  );
}

describe('ToolSystemProvider variant boundary', () => {
  it('classifies non-native tool descriptions as variant_accumulate/variant', () => {
    const ctx = makeCtx({
      providerId: 'OLLAMA',
      model: 'llama2',
      tools: [{ id: 't1', name: 'search', description: '搜索', parameters: {} } as never]
    });
    const toolContribution = contributionFrom(ctx, 'tool_system');

    expect(toolContribution?.phase).toBe('variant_accumulate');
    expect(toolContribution?.cacheClass).toBe('variant');
    expect(toolContribution?.content).toContain('<tools');
  });

  it('derives variantKey from canonical sorted tool definitions', () => {
    const provider = new ToolSystemProvider();
    const first = provider.build(
      makeCtx({
        providerId: 'OLLAMA',
        model: 'llama2',
        tools: [
          { id: 't2', name: 'z_tool', description: 'Z', parameters: { type: 'object' } } as never,
          { id: 't1', name: 'a_tool', description: 'A', parameters: { type: 'object' } } as never
        ]
      })
    );
    const second = provider.build(
      makeCtx({
        providerId: 'OLLAMA',
        model: 'llama2',
        tools: [
          { id: 't1', name: 'a_tool', description: 'A', parameters: { type: 'object' } } as never,
          { id: 't2', name: 'z_tool', description: 'Z', parameters: { type: 'object' } } as never
        ]
      })
    );

    expect(first?.variantKey).toBeTruthy();
    expect(first?.variantKey).toBe(second?.variantKey);
  });
});

describe('ModelHintProvider variant boundary', () => {
  it('classifies agent/model configuration hints as variant_accumulate/variant', () => {
    const ctx = makeCtx({
      providerId: 'GEMINI',
      structuredPrompt: { modelHints: { GEMINI: '自定义模型提示' } }
    });
    const modelHintContribution = contributionFrom(ctx, 'model_hint');

    expect(modelHintContribution?.phase).toBe('variant_accumulate');
    expect(modelHintContribution?.cacheClass).toBe('variant');
    expect(modelHintContribution?.content).toContain('自定义模型提示');
  });

  it('does not render per-turn web search policy in prompt contributions', () => {
    const provider = new ModelHintProvider();
    const result = provider.build(
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

    expect(result).toBeNull();
  });
});

const WEB_SEARCH_HINT_MARKERS = ['内置搜索', '实时外部信息', '联网工具'];

const WEB_SEARCH_POLICIES = {
  off: {
    effectiveMode: 'off' as const,
    injectToolIds: [],
    stripToolIds: ['web_search'],
    enableProviderBuiltinSearch: false,
    degradedFromProvider: false
  },
  app: {
    effectiveMode: 'app' as const,
    injectToolIds: ['web_search'],
    stripToolIds: [],
    enableProviderBuiltinSearch: false,
    degradedFromProvider: false
  },
  provider: {
    effectiveMode: 'provider' as const,
    injectToolIds: ['crawl_single_page'],
    stripToolIds: ['web_search'],
    enableProviderBuiltinSearch: true,
    degradedFromProvider: false
  }
};

function makeWebSearchPipelineInput() {
  return {
    agentDef: {
      id: 'a',
      name: 'A',
      description: '',
      systemPrompt: 'You are X',
      providerId: 'GEMINI',
      model: 'gemini-2.0-flash',
      temperature: 0,
      toolIds: [],
      skillIds: [],
      mcpServerIds: []
    } as never,
    providerId: 'GEMINI',
    providerConfig: { type: 'GEMINI' } as never,
    model: 'gemini-2.0-flash',
    tools: [],
    skills: [],
    mcpTools: [],
    skillMetadata: []
  };
}

describe('web search policy placement', () => {
  it('isolates web search policy to TurnContext without affecting prompt stable or variant assembly', async () => {
    const baseInput = makeWebSearchPipelineInput();
    const assembledByPolicy = Object.fromEntries(
      Object.entries(WEB_SEARCH_POLICIES).map(([mode, webSearchPolicy]) => [
        mode,
        assembleSystemMessages(
          buildPromptPipelineContext({
            ...baseInput,
            webSearchPolicy
          })
        )
      ])
    );

    const stableContents = Object.values(assembledByPolicy).map(
      (assembled) => assembled.systemMessage.content
    );
    const stableHashes = stableContents.map((content) => hashString(content));
    const variantContents = Object.values(assembledByPolicy).map((assembled) =>
      assembled.variantMessages.map((message) => message.content).join('\n')
    );

    expect(new Set(stableHashes).size).toBe(1);
    expect(new Set(stableContents).size).toBe(1);
    expect(new Set(variantContents).size).toBe(1);

    for (const stableContent of stableContents) {
      for (const marker of WEB_SEARCH_HINT_MARKERS) {
        expect(stableContent).not.toContain(marker);
      }
    }
    for (const variantContent of variantContents) {
      for (const marker of WEB_SEARCH_HINT_MARKERS) {
        expect(variantContent).not.toContain(marker);
      }
      expect(variantContent).not.toContain('<model_hint>');
    }

    const assembler = new TurnContextAssembler({
      knowledge: async () => ({}),
      memory: async () => ({}),
      workspace: async () => ({})
    });
    const runtimeMetadataByMode = Object.fromEntries(
      await Promise.all(
        Object.entries(WEB_SEARCH_POLICIES).map(async ([mode, webSearchPolicy]) => {
          const context = await assembler.assemble({
            turnId: `turn-search-${mode}`,
            agentDef: makeCtx().agentDef,
            userInput: 'search',
            webSearchPolicy
          });
          const runtimeSource = context.sources.find((source) => source.source === 'runtime');
          return [mode, runtimeSource?.content ?? ''];
        })
      )
    );

    expect(runtimeMetadataByMode.off).toContain('"effectiveMode":"off"');
    expect(runtimeMetadataByMode.app).toContain('"effectiveMode":"app"');
    expect(runtimeMetadataByMode.provider).toContain('"effectiveMode":"provider"');
    expect(new Set(Object.values(runtimeMetadataByMode)).size).toBe(3);
  });

  it('represents dynamic web search policy in TurnContext runtime metadata', async () => {
    const assembler = new TurnContextAssembler({
      knowledge: async () => ({}),
      memory: async () => ({}),
      workspace: async () => ({})
    });

    const context = await assembler.assemble({
      turnId: 'turn-search',
      agentDef: makeCtx().agentDef,
      userInput: 'search',
      webSearchPolicy: {
        effectiveMode: 'app',
        injectToolIds: ['web_search'],
        stripToolIds: [],
        enableProviderBuiltinSearch: false,
        degradedFromProvider: false
      }
    });

    expect(context.sources).toContainEqual(
      expect.objectContaining({
        source: 'runtime',
        trust: 'runtime_metadata',
        content: expect.stringContaining('"effectiveMode":"app"')
      })
    );
  });
});
