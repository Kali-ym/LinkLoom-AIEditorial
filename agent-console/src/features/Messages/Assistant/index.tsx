import { Flexbox } from '@lobehub/ui';
import { memo, useMemo } from 'react';

import { formatMessageTime } from '../../../utils/userMessageContent';
import type { Message } from '../../../domain/types';
import type { StaticAssistantMessage } from '../../../domain/types/conversation';
import type { StreamingMessage } from '../../../stores/types';
import { AssistantGroupContent } from '../AssistantGroup/AssistantGroupContent';
import type { WorkflowExpandLevelDefault } from '../AssistantGroup/WorkflowCollapse';
import { messageToAssistantBlocks, streamingMessageToBlocks } from '../AssistantGroup/messageToBlocks';
import { messageHasPendingIntervention, selectPendingInterventionsFromStreaming } from '../../../selectors/pendingInterventions';
import { AssistantMessageContent } from './AssistantMessageContent';
import { AssistantMessageShell } from './AssistantMessageShell';
import { FollowUpChips } from '../../Conversation/FollowUp/FollowUpChips';
import { ReactionDisplay } from '../Reaction/ReactionDisplay';

function hasWorkflowTools(blocks: ReturnType<typeof messageToAssistantBlocks>) {
  return blocks.some((b) => b.tools && b.tools.length > 0);
}

export const AssistantMessageView = memo(function AssistantMessageView({
  agentId,
  agentName,
  time,
  blocks,
  isGenerating = false,
  defaultWorkflowExpandLevel,
  id,
  className,
  stopped,
  loading,
  index = 0,
  topicId,
}: {
  agentId?: string;
  agentName?: string;
  time: string;
  blocks: ReturnType<typeof messageToAssistantBlocks>;
  isGenerating?: boolean;
  defaultWorkflowExpandLevel?: WorkflowExpandLevelDefault;
  id?: string;
  className?: string;
  stopped?: boolean;
  loading?: boolean;
  index?: number;
  topicId?: string;
}) {
  const useGroup = hasWorkflowTools(blocks);

  return (
    <AssistantMessageShell
      agentId={agentId}
      agentName={agentName}
      className={className}
      id={id}
      index={index}
      loading={loading}
      stopped={stopped}
      time={time}
      topicId={topicId}
    >
      {useGroup ? (
        <AssistantGroupContent
          assistantMessageId={id ?? 'streaming'}
          blocks={blocks}
          defaultWorkflowExpandLevel={defaultWorkflowExpandLevel}
          isGenerating={isGenerating}
          topicId={topicId}
        />
      ) : (
        <Flexbox gap={8} style={{ width: '100%' }}>
          {blocks.map((block, blockIndex) => (
            <AssistantMessageContent
              key={block.id}
              content={block.content}
              grounding={block.grounding}
              images={block.images}
              messageId={block.id}
              reasoning={block.reasoning}
              streaming={isGenerating && blockIndex === blocks.length - 1}
            />
          ))}
        </Flexbox>
      )}
      {id ? <ReactionDisplay messageId={id} /> : null}
      {id && topicId ? <FollowUpChips conversationKey={topicId} messageId={id} /> : null}
    </AssistantMessageShell>
  );
});

export const RichAssistantMessageView = memo(function RichAssistantMessageView({
  message,
  defaultWorkflowExpandLevel,
  topicId,
  index = 0,
}: {
  message: Message;
  defaultWorkflowExpandLevel?: WorkflowExpandLevelDefault;
  topicId: string;
  index?: number;
}) {
  const blocks = useMemo(() => messageToAssistantBlocks(message), [message]);
  return (
    <AssistantMessageView
      agentId={message.agentId}
      blocks={blocks}
      defaultWorkflowExpandLevel={defaultWorkflowExpandLevel}
      id={message.id}
      index={index}
      stopped={message.stopped && !messageHasPendingIntervention(message)}
      time={formatMessageTime(message.createdAt)}
      topicId={topicId}
    />
  );
});

export const StreamingAssistantMessage = memo(function StreamingAssistantMessage({
  message,
  defaultWorkflowExpandLevel,
  topicId,
}: {
  message: StreamingMessage;
  defaultWorkflowExpandLevel?: WorkflowExpandLevelDefault;
  topicId: string;
}) {
  const streaming = Boolean(message.streaming);
  const time = formatMessageTime(new Date().toISOString());
  const hasPending = selectPendingInterventionsFromStreaming(message).length > 0;

  return (
    <AssistantMessageView
      blocks={streamingMessageToBlocks(message)}
      defaultWorkflowExpandLevel={defaultWorkflowExpandLevel}
      id={message.id}
      isGenerating={streaming}
      stopped={message.stopped && !hasPending}
      time={time}
      topicId={topicId}
    />
  );
});

export const StaticAssistantMessageView = memo(function StaticAssistantMessageView({
  message,
}: {
  message: StaticAssistantMessage;
}) {
  const md = [
    `### ${message.markdown.title}`,
    message.markdown.intro,
    ...message.markdown.bullets.map((b) => `- **${b.term}** — ${b.detail}`),
    message.markdown.footer,
  ].join('\n\n');

  const blocks = messageToAssistantBlocks({
    id: message.id,
    content: md,
    grounding: message.grounding,
    tool: message.tool,
    reasoningBeforeTool: message.reasoningBeforeTool,
    reasoningAfterTool: message.reasoningAfterTool,
  });

  return (
    <AssistantMessageView
      agentName={message.agentName}
      blocks={blocks}
      id={message.id}
      time={formatMessageTime(message.time)}
    />
  );
});
