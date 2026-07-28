import { memo } from 'react';

import type { ToolPayload } from '../../domain/types/tool';
import { WorkflowBlock } from './WorkflowBlock';

/** 多工具 Workflow — 原生 `.workflow-block` DOM */
export const WorkflowMessage = memo(function WorkflowMessage({
  title,
  tools,
  duration,
  streaming,
  defaultExpanded,
}: {
  title?: string;
  tools: ToolPayload[];
  duration?: string;
  streaming?: boolean;
  defaultExpanded?: boolean;
}) {
  return (
    <WorkflowBlock
      tools={tools}
      title={title}
      duration={duration}
      streaming={streaming}
      defaultOpen={defaultExpanded}
    />
  );
});
