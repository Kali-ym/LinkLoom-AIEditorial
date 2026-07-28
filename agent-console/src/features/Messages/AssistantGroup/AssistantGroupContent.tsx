import { Fragment } from 'react';
import type { AssistantContentBlock } from '../../../domain/types';
import { filterResolvableTools } from '../../../domain/utils/toolDisplayIdentity';
import { AssistantMessageContent } from '../Assistant/AssistantMessageContent';
import { ToolAccordion } from '../ToolAccordion';
import { WorkflowCollapse } from './WorkflowCollapse';
import type { WorkflowExpandLevelDefault } from './WorkflowCollapse';

/** Linear assistant turn: reasoning → tool → reasoning → … → answer */
export function AssistantGroupContent({
  blocks,
  isGenerating,
  assistantMessageId,
  topicId,
  defaultWorkflowExpandLevel,
}: {
  blocks: AssistantContentBlock[];
  isGenerating: boolean;
  assistantMessageId: string;
  topicId?: string;
  defaultWorkflowExpandLevel?: WorkflowExpandLevelDefault;
}) {
  return (
    <div style={{ width: '100%' }}>
      {blocks.map((block, index) => {
        const tools = filterResolvableTools(block.tools ?? []);
        const toolCount = tools.length;
        const singleTool = toolCount === 1 ? tools[0] : undefined;
        const singleToolCallId = singleTool?.toolCallId ?? singleTool?.id;
        const isAnswerTail =
          Boolean(block.content?.trim() || block.images?.length) && index === blocks.length - 1;

        return (
          <Fragment key={block.id}>
            {block.grounding ? (
              <AssistantMessageContent grounding={block.grounding} messageId={block.id} />
            ) : null}
            {block.reasoning ? (
              <AssistantMessageContent messageId={block.id} reasoning={block.reasoning} />
            ) : null}
            {toolCount > 1 ? (
              <WorkflowCollapse
                assistantMessageId={assistantMessageId}
                blocks={[{ ...block, tools }]}
                defaultWorkflowExpandLevel={defaultWorkflowExpandLevel}
                isGenerating={isGenerating}
                topicId={topicId}
              />
            ) : null}
            {singleTool ? (
              <ToolAccordion
                assistantMessageId={assistantMessageId}
                showActions
                tool={singleTool}
                topicId={topicId}
                toolRemoval={
                  topicId && singleToolCallId
                    ? { messageId: assistantMessageId, toolCallId: singleToolCallId }
                    : undefined
                }
              />
            ) : null}
            {block.content || block.images?.length ? (
              <AssistantMessageContent
                content={block.content}
                images={block.images}
                messageId={block.id}
                streaming={isGenerating && isAnswerTail}
              />
            ) : null}
          </Fragment>
        );
      })}
    </div>
  );
}
