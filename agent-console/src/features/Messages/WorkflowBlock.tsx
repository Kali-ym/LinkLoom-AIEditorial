import { memo } from 'react';

import type { ToolPayload } from '../../domain/types/tool';
import { WorkflowCollapse } from './AssistantGroup/WorkflowCollapse';

/** Showcase / legacy API — delegates to §C.12 WorkflowCollapse */
export const WorkflowBlock = memo(function WorkflowBlock({
  tools,
  streaming,
  defaultOpen = false,
}: {
  tools: ToolPayload[];
  streaming?: boolean;
  defaultOpen?: boolean;
  duration?: string;
  title?: string;
}) {
  if (!tools.length) return null;

  return (
    <WorkflowCollapse
      assistantMessageId="workflow-showcase"
      blocks={[{ id: 'workflow-showcase-block', tools }]}
      defaultWorkflowExpandLevel={defaultOpen ? { streaming: 'full' } : undefined}
      isGenerating={Boolean(streaming || tools.some((t) => t.state === 'executing'))}
    />
  );
});
