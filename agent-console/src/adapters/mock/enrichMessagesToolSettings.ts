import type { AssistantContentBlock, Message } from '../../domain/types';
import { enrichToolPayload, enrichToolPayloads } from './pluginSettingsSchema';

function enrichAssistantBlock(block: AssistantContentBlock): AssistantContentBlock {
  if (!block.tools?.length) return block;
  return { ...block, tools: enrichToolPayloads(block.tools) };
}

/** §C.26 — mock 消息加载时填充 `tool.settingsSchema` */
export function enrichMessageToolSettings(message: Message): Message {
  let next = message;

  if (message.tool) {
    const tool = enrichToolPayload(message.tool);
    if (tool !== message.tool) next = { ...next, tool };
  }

  if (message.tools?.length) {
    const tools = enrichToolPayloads(message.tools);
    if (tools !== message.tools) next = { ...next, tools };
  }

  if (message.children?.length) {
    const children = message.children.map(enrichAssistantBlock);
    if (children !== message.children) next = { ...next, children };
  }

  if (message.compressedMessages?.length) {
    const compressedMessages = enrichMessagesToolSettings(message.compressedMessages);
    if (compressedMessages !== message.compressedMessages) {
      next = { ...next, compressedMessages };
    }
  }

  if (message.tasks?.length) {
    const tasks = enrichMessagesToolSettings(message.tasks);
    if (tasks !== message.tasks) next = { ...next, tasks };
  }

  return next;
}

export function enrichMessagesToolSettings(messages: Message[]): Message[] {
  return messages.map(enrichMessageToolSettings);
}
