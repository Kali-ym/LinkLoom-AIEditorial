import { memo } from 'react';

import type { ToolPayload } from '../../domain/types/tool';
import type { ToolRemovalRef } from './AssistantGroup/Tool/Actions';
import { ToolAccordion } from './ToolAccordion';

/** index.html `.tool-accordion` / `#toolBlock` */
export const ToolMessage = memo(function ToolMessage({
  tool,
  id = 'toolBlock',
  topicId,
  assistantMessageId,
  toolRemoval,
}: {
  tool: ToolPayload;
  id?: string;
  topicId?: string;
  assistantMessageId?: string;
  toolRemoval?: ToolRemovalRef;
}) {
  return (
    <ToolAccordion
      assistantMessageId={assistantMessageId}
      id={id}
      showActions
      tool={tool}
      topicId={topicId}
      toolRemoval={toolRemoval}
    />
  );
});
