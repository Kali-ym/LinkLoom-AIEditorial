import type { StaticReasoningBlock } from './conversation';
import type { ToolPayload } from './tool';

/** One ordered step in an assistant turn: reasoning → text → tool(s) → reasoning → text → …
 *  Text segments keep non-reasoning assistant output interleaved with reasoning
 *  and tool segments in arrival order, rather than collapsing all text into a
 *  single trailing answer block. */
export type AssistantTurnSegment =
  | { kind: 'reasoning'; id: string; reasoning: StaticReasoningBlock }
  | { kind: 'text'; id: string; text: string }
  | { kind: 'tool'; id: string; tool: ToolPayload }
  | { kind: 'tools'; id: string; tools: ToolPayload[] };
