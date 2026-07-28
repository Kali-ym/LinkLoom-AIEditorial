import { memo } from 'react';

import { useWorkspaceStore } from '../../../stores';
import { ToolMessage } from '../../Messages/ToolMessage';
import { WorkflowMessage } from '../../Messages/WorkflowMessage';
import { ShowcasePanel } from './ShowcasePanel';
import { showcaseStyles } from './showcaseStyles';

/** index.html `#toolDemoMount` */
export const ToolShowcase = memo(function ToolShowcase() {
  const tools = useWorkspaceStore((s) => s.showcase.tools);
  const completedCount = tools.workflowCompleted.tools.length;
  const streamingCount = tools.workflowStreaming.tools.length;

  return (
    <ShowcasePanel itemKey="tools" title={tools.title}>
      <div className={showcaseStyles.toolDemoGrid} id="toolDemoMount">
        {tools.accordions.map((tool, index) => (
          <ToolMessage key={`${tool.plugin}-${tool.api}-${index}`} tool={tool} />
        ))}
        <WorkflowMessage
          title={`${completedCount} 次工具调用 · 已完成`}
          tools={tools.workflowCompleted.tools}
          duration={tools.workflowCompleted.opts.duration}
          defaultExpanded
        />
        <WorkflowMessage
          title={`${streamingCount} 次工具调用 · 流式进行中`}
          tools={tools.workflowStreaming.tools}
          duration={tools.workflowStreaming.opts.duration}
          streaming
          defaultExpanded
        />
      </div>
    </ShowcasePanel>
  );
});
