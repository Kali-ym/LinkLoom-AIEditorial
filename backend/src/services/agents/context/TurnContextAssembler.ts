import type { AgentDefinition } from '../../../types/agent.js';
import type { SystemSettings } from '../../../types/config.js';
import { stableStringify } from '../engine/canonicalMessageSerializer.js';
import type { WebSearchPolicy } from '../search/types.js';
import {
  createTurnContext,
  type ContextSource,
  type ContextTrust,
  type TurnContext,
  type TurnContextSourceInput,
} from './PiContextTypes.js';

const sourceOrder: Array<{
  source: ContextSource;
  key: 'knowledge' | 'memory' | 'workspace';
}> = [
  { source: 'knowledge', key: 'knowledge' },
  { source: 'memory', key: 'memory' },
  { source: 'workspace', key: 'workspace' },
];

export interface TurnContextResolverInput {
  agentDef: AgentDefinition;
  userInput: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
  settings?: SystemSettings | null;
  date?: string;
  webSearchPolicy?: WebSearchPolicy;
}

export interface TurnContextResolverResult {
  content?: string;
  error?: boolean;
  trust?: ContextTrust;
}

export interface TurnContextAssemblerDependencies {
  knowledge(input: TurnContextResolverInput): Promise<TurnContextResolverResult>;
  memory(input: TurnContextResolverInput): Promise<TurnContextResolverResult>;
  workspace(input: TurnContextResolverInput): Promise<TurnContextResolverResult>;
}

export class TurnContextAssembler {
  constructor(private readonly dependencies: TurnContextAssemblerDependencies) {}

  async assemble(
    input: TurnContextResolverInput & { turnId: string },
  ): Promise<TurnContext> {
    const sources: TurnContextSourceInput[] = [];
    const sourceErrors: Array<{ source: ContextSource; code: 'unavailable' }> = [];

    if (input.date?.trim()) {
      sources.push({
        source: 'date',
        content: `当前处理日期为: ${input.date.trim()}`,
        trust: 'runtime_metadata',
      });
    }

    if (input.webSearchPolicy) {
      sources.push({
        source: 'runtime',
        content: `当前 turn 联网搜索策略: ${stableStringify(input.webSearchPolicy)}`,
        trust: 'runtime_metadata',
      });
    }

    if (input.userInput.trim()) {
      for (const item of sourceOrder) {
        try {
          const result = await this.dependencies[item.key](input);
          if (result.content?.trim()) {
            sources.push({
              source: item.source,
              content: result.content.trim(),
              trust:
                result.trust ??
                (item.key === 'workspace' ? 'runtime_metadata' : 'untrusted_data'),
            });
          } else if (result.error) {
            sourceErrors.push({ source: item.source, code: 'unavailable' });
          }
        } catch {
          sourceErrors.push({ source: item.source, code: 'unavailable' });
        }
      }
    }

    return createTurnContext({
      turnId: input.turnId,
      sources,
      sourceErrors,
    });
  }
}
