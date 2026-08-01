import { convertToLlmMessages } from './LlmMessageConverter.js';
import type {
  ContextMessage,
  LlmRequestContext,
  SessionContext,
  TurnContext,
} from './PiContextTypes.js';

export interface TransformContextInput {
  session: SessionContext;
  turn: TurnContext;
}

export class ContextTransformer {
  transform(input: TransformContextInput): LlmRequestContext {
    const sourceErrorMessages: ContextMessage[] = input.turn.sourceErrors.map((error) => ({
      id: `${input.turn.turnId}:runtime:${error.source}`,
      turnId: input.turn.turnId,
      source: 'runtime',
      content: `自动 ${error.source} context 当前不可用；不要假设本轮已经获得该来源的数据。`,
      trust: 'runtime_metadata',
      instructionPolicy: 'reference_only',
      persist: false,
    }));
    const ephemeralMessages = [...input.turn.sources, ...sourceErrorMessages];
    const systemInstruction = [
      input.session.stableSystemPrompt,
      ...input.session.variantMessages
        .filter((message) => message.role === 'system')
        .map((message) => String(message.content ?? '').trim())
        .filter(Boolean),
    ]
      .filter(Boolean)
      .join('\n\n');

    return {
      systemInstruction,
      messages: convertToLlmMessages({
        trajectory: input.session.trajectory,
        ephemeralMessages,
      }),
      providerTools: structuredClone(input.session.providerTools),
      ephemeralMessages: structuredClone(ephemeralMessages),
      turnContextFingerprint: input.turn.fingerprint,
      diagnostics: input.turn.sourceErrors.map(
        (error) => `turn_context_source_failed:${error.source}`,
      ),
    };
  }
}
