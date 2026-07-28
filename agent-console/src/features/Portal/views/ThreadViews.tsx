import { Alert, Button, Flexbox, Markdown, SyntaxHighlighter, Text } from '@lobehub/ui';
import { cssVar } from 'antd-style';
import { memo, useMemo } from 'react';

import { threadBubblesToMessages } from '../../../domain/utils/threadBubbles';
import { selectDmMessagesForAgent, selectMessagesForThread } from '../../../selectors/portalSelectors';
import type { PortalViewPayload } from '../../../domain/types/portalView';
import { useChatStore, useTopicStore, useWorkspaceStore } from '../../../stores';
import { UserMessage } from '../../Conversation/ChatList';
import { MessageActionProvider } from '../../Messages/Contexts/MessageActionProvider';
import { MessageItem } from '../../Messages/MessageItem';
import { openThreadPortal } from '../portalActions';
import { portalStrings } from '../portalStrings';
import { portalViewStyles } from '../portalViewStyles';

function confidenceColor(ratio: number): string {
  if (ratio >= 80) return cssVar.colorSuccess;
  if (ratio >= 60) return cssVar.colorWarning;
  return cssVar.colorError;
}

/** §C.21 Thread Body*/
export const ThreadView = memo(function ThreadView({ payload }: { payload: PortalViewPayload }) {
  const topicId = useTopicStore((s) => s.activeTopicId);
  const threadId = payload.threadId ?? payload.id?.toString() ?? 'branch-1';
  const storeMessages = useChatStore(selectMessagesForThread(topicId, threadId));
  const defaultBubbles = useWorkspaceStore((s) => s.portalContent.threadBubbles);
  const isSubagent = payload.isSubagent ?? false;

  const messages = useMemo(() => {
    if (storeMessages.length > 0) return storeMessages;
    return threadBubblesToMessages(payload.bubbles ?? defaultBubbles, threadId);
  }, [defaultBubbles, payload.bubbles, storeMessages, threadId]);

  const lastUserIndex = messages.reduce((acc, m, i) => (m.role === 'user' ? i : acc), -1);
  const lastUserMessageId = messages[lastUserIndex]?.id ?? '';

  return (
    <Flexbox className={portalViewStyles.scrollBody} flex={1} style={{ minHeight: 0 }}>
      <MessageActionProvider lastUserMessageId={lastUserMessageId} topicId={topicId}>
        <Flexbox gap={12} style={{ padding: '8px 12px' }}>
          {messages.map((message, index) =>
            message.role === 'user' ? (
              <UserMessage
                key={message.id}
                index={index}
                isLastUser={index === lastUserIndex}
                message={message}
                topicId={topicId}
              />
            ) : (
              <MessageItem key={message.id} index={index} message={message} topicId={topicId} />
            ),
          )}
        </Flexbox>
      </MessageActionProvider>
      {isSubagent ? (
        <Text fontSize={12} style={{ padding: '8px 12px', textAlign: 'center' }} type="secondary">
          {portalStrings.thread.subagentReadonly}
        </Text>
      ) : null}
    </Flexbox>
  );
});

/** §C.21 GroupThread Body*/
export const GroupThreadView = memo(function GroupThreadView({
  payload,
}: {
  payload: PortalViewPayload;
}) {
  const topicId = useTopicStore((s) => s.activeTopicId);
  const agentId = payload.agentId ?? 'inbox';
  const dmMessages = useChatStore(selectDmMessagesForAgent(topicId, agentId));

  if (!dmMessages.length) {
    return (
      <Flexbox align="center" justify="center" style={{ padding: '32px 16px' }}>
        <Text fontSize={14} style={{ color: '#999', textAlign: 'center' }}>
          {portalStrings.groupThread.empty}
        </Text>
      </Flexbox>
    );
  }

  const lastUserIndex = dmMessages.reduce((acc, m, i) => (m.role === 'user' ? i : acc), -1);
  const lastUserMessageId = dmMessages[lastUserIndex]?.id ?? '';

  return (
    <Flexbox className={portalViewStyles.scrollBody} flex={1} style={{ minHeight: 0 }}>
      <MessageActionProvider lastUserMessageId={lastUserMessageId} topicId={topicId}>
        <Flexbox gap={12} style={{ padding: '8px 12px' }}>
          {dmMessages.map((message, index) =>
            message.role === 'user' ? (
              <UserMessage
                key={message.id}
                index={index}
                isLastUser={index === lastUserIndex}
                message={message}
                topicId={topicId}
              />
            ) : (
              <MessageItem key={message.id} index={index} message={message} topicId={topicId} />
            ),
          )}
        </Flexbox>
      </MessageActionProvider>
    </Flexbox>
  );
});

/** §C.21 VerifyResult*/
export const VerifyResultView = memo(function VerifyResultView({
  payload,
}: {
  payload: PortalViewPayload;
}) {
  const ratio = Math.round((payload.confidence ?? 0.92) * 100);
  const assertion = `${payload.assertion ?? ''} — ${payload.passed ? 'passed' : 'failed'}`;
  const fillColor = confidenceColor(ratio);
  const pending = payload.pending ?? false;

  return (
    <Flexbox
      className={portalViewStyles.bodyRoot}
      gap={16}
      style={{ paddingBlock: '4px 16px', paddingInline: 8 }}
    >
      {pending ? <Alert message={portalStrings.verify.pending} type="info" /> : null}

      <div className={portalViewStyles.verifyCard}>
        <Text fontSize={12} type="secondary">
          {portalStrings.verify.confidence}
        </Text>
        <Text style={{ fontSize: 20, fontWeight: 700, color: fillColor }}>{ratio}%</Text>
        <div className={portalViewStyles.verifyTrack} style={{ marginTop: 8 }}>
          <div style={{ width: `${ratio}%`, height: '100%', background: fillColor }} />
        </div>
      </div>

      <Flexbox gap={8}>
        <Text fontSize={13}>
          <strong>{portalStrings.verify.verifier}</strong> · {payload.verifier || 'playwright'}
        </Text>
        {payload.instruction ? (
          <Text fontSize={13}>
            <strong>{portalStrings.verify.instruction}</strong> · {payload.instruction}
          </Text>
        ) : null}
      </Flexbox>

      {payload.detailMarkdown ? (
        <Markdown variant="chat">{payload.detailMarkdown}</Markdown>
      ) : null}

      <Text fontSize={12} type="secondary">
        {portalStrings.verify.assertion}
      </Text>
      <SyntaxHighlighter language="text" variant="borderless">
        {assertion}
      </SyntaxHighlighter>

      <Button
        type="default"
        onClick={() => openThreadPortal('验证轨迹', String(payload.id ?? 'trace'))}
      >
        {portalStrings.verify.trace}
      </Button>
    </Flexbox>
  );
});
