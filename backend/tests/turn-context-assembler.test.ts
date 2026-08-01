import { describe, expect, it, vi } from 'vitest';
import { TurnContextAssembler } from '../src/services/agents/context/TurnContextAssembler.js';

const agentDef = {
  id: 'agent-1',
  name: 'Agent',
  knowledgeCategoryIds: ['kb-1'],
  memoryCategoryIds: ['mem-1'],
} as never;

describe('TurnContextAssembler', () => {
  it('resolves each automatic source once and returns ephemeral sources', async () => {
    const knowledge = vi.fn().mockResolvedValue({ content: 'kb evidence' });
    const memory = vi.fn().mockResolvedValue({ content: 'memory fact' });
    const workspace = vi.fn().mockResolvedValue({ content: '- [ ] task' });
    const assembler = new TurnContextAssembler({ knowledge, memory, workspace });

    const context = await assembler.assemble({
      turnId: 'turn-1',
      agentDef,
      userInput: 'question',
      sessionId: 'session-1',
      date: '2026-08-01',
    });

    expect(knowledge).toHaveBeenCalledTimes(1);
    expect(memory).toHaveBeenCalledTimes(1);
    expect(workspace).toHaveBeenCalledTimes(1);
    expect(context.sources.map((source) => source.source)).toEqual([
      'date',
      'knowledge',
      'memory',
      'workspace',
    ]);
    expect(context.sources[0]).toMatchObject({
      trust: 'runtime_metadata',
      content: '当前处理日期为: 2026-08-01',
    });
    expect(context.sources.every((source) => source.persist === false)).toBe(true);
  });

  it('records resolver failures without exposing the error text', async () => {
    const assembler = new TurnContextAssembler({
      knowledge: vi.fn().mockRejectedValue(new Error('private retrieval stack')),
      memory: vi.fn().mockResolvedValue({}),
      workspace: vi.fn().mockResolvedValue({}),
    });

    const context = await assembler.assemble({
      turnId: 'turn-2',
      agentDef,
      userInput: 'question',
    });

    expect(context.sourceErrors).toEqual([{ source: 'knowledge', code: 'unavailable' }]);
    expect(JSON.stringify(context)).not.toContain('stack');
  });

  it('does not call retrieval for an empty user input', async () => {
    const knowledge = vi.fn();
    const memory = vi.fn();
    const workspace = vi.fn().mockResolvedValue({});
    const assembler = new TurnContextAssembler({ knowledge, memory, workspace });

    await assembler.assemble({
      turnId: 'turn-3',
      agentDef,
      userInput: '   ',
    });

    expect(knowledge).not.toHaveBeenCalled();
    expect(memory).not.toHaveBeenCalled();
  });

  it('keeps the resolved search policy in ephemeral runtime metadata', async () => {
    const assembler = new TurnContextAssembler({
      knowledge: vi.fn().mockResolvedValue({}),
      memory: vi.fn().mockResolvedValue({}),
      workspace: vi.fn().mockResolvedValue({}),
    });

    const context = await assembler.assemble({
      turnId: 'turn-4',
      agentDef,
      userInput: 'search',
      webSearchPolicy: {
        effectiveMode: 'app',
        injectToolIds: ['web_search'],
        stripToolIds: [],
        enableProviderBuiltinSearch: false,
        degradedFromProvider: false,
      },
    });

    expect(context.sources).toContainEqual(
      expect.objectContaining({
        source: 'runtime',
        trust: 'runtime_metadata',
        persist: false,
        content: expect.stringContaining('"effectiveMode":"app"'),
      }),
    );
  });
});
