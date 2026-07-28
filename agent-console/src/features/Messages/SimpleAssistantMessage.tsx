import { memo } from 'react';

import { formatMessageTime } from '../../utils/userMessageContent';
import { AssistantMessageShell } from './Assistant/AssistantMessageShell';
import { AssistantMessageContent } from './Assistant/AssistantMessageContent';

/** index.html 简单助手消息 */
export const SimpleAssistantMessageView = memo(function SimpleAssistantMessageView({
  agentId,
  agentName,
  time,
  content,
  codeBlock = false,
}: {
  agentId?: string;
  agentName?: string;
  time: string;
  content: string;
  codeBlock?: boolean;
}) {
  return (
    <AssistantMessageShell agentId={agentId} agentName={agentName} time={formatMessageTime(time)}>
      {codeBlock ? (
        <pre
          style={{
            margin: 0,
            padding: 12,
            borderRadius: 8,
            font: '13px/1.5 var(--font-mono)',
            overflowX: 'auto',
          }}
        >
          <code>{content}</code>
        </pre>
      ) : (
        <AssistantMessageContent content={content} />
      )}
    </AssistantMessageShell>
  );
});
