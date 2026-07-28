import type { AssistantContentBlock } from '../../../../domain/types';
import type { TaskThreadMessage } from '../../../../domain/types/taskMessage';

/** Extract assistant blocks from thread messages for TaskMessages rendering */
export function extractTaskBlocks(messages: TaskThreadMessage[] | undefined): AssistantContentBlock[] {
  if (!messages?.length) return [];
  const blocks: AssistantContentBlock[] = [];
  for (const msg of messages) {
    if (msg.children?.length) {
      blocks.push(...msg.children);
    } else if (msg.content) {
      blocks.push({ id: msg.id, content: msg.content });
    }
  }
  return blocks;
}

export function countToolCalls(blocks: AssistantContentBlock[]): number {
  return blocks.reduce((sum, block) => sum + (block.tools?.length ?? 0), 0);
}
