import type { ToolPayload } from '../../../domain/types';
import { hasResolvableToolIdentity } from '../../../domain/utils/toolDisplayIdentity';
import { WORKFLOW_EXPANDED_SCROLL_THRESHOLD_PX } from './constants';
import { useAutoScroll } from '../useAutoScroll';
import { ToolAccordion } from '../ToolAccordion';

/** §C.12 — expanded workflow tool list with auto-scroll */
export function WorkflowExpandedList({
  tools,
  streaming,
  constrained,
  topicId,
  assistantMessageId,
}: {
  tools: ToolPayload[];
  streaming: boolean;
  constrained?: boolean;
  topicId?: string;
  assistantMessageId?: string;
}) {
  const { ref, handleScroll } = useAutoScroll<HTMLDivElement>({
    deps: [tools.length, streaming],
    enabled: Boolean(constrained && streaming),
    threshold: WORKFLOW_EXPANDED_SCROLL_THRESHOLD_PX,
  });

  return (
    <div
      ref={ref}
      onScroll={handleScroll}
      style={{
        maxHeight: constrained ? 'min(40vh, 320px)' : undefined,
        overflowY: constrained ? 'auto' : undefined,
      }}
    >
      {tools.filter(hasResolvableToolIdentity).map((tool, index) => {
        const toolCallId = tool.toolCallId ?? tool.id;
        return (
          <ToolAccordion
            key={`${tool.plugin}-${tool.api}-${index}`}
            assistantMessageId={assistantMessageId}
            defaultOpen={streaming}
            inWorkflow
            showActions={!streaming}
            tool={tool}
            topicId={topicId}
            toolRemoval={
              topicId && assistantMessageId && toolCallId
                ? { messageId: assistantMessageId, toolCallId }
                : undefined
            }
          />
        );
      })}
    </div>
  );
}
