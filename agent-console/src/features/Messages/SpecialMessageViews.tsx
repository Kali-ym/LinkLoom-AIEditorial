import {
  ActionIcon,
  Block,
  Button,
  Flexbox,
  Icon,
  Markdown,
  Segmented,
  Tabs,
  Tag,
  Text,
} from '@lobehub/ui';
import { confirmModal } from '@lobehub/ui/base-ui';
import { createStaticStyles, cssVar } from 'antd-style';
import {
  Bot,
  Check,
  ChevronDown,
  ChevronUp,
  Columns2,
  History,
  Layers,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Undo2,
  Users,
  X,
} from 'lucide-react';
import { memo, useMemo, useState } from 'react';

import { getVerifyState } from '../../hooks/data/useRuntime';
import type { Message } from '../../domain/types';
import { showToast } from '../../services/ui/toast';
import { useChatStore, useTopicStore } from '../../stores';
import { useCompressionUiStore } from '../../stores/compressionUiStore';
import { formatMessageTime } from '../../utils/userMessageContent';
import { ChatItem } from '../Conversation/ChatItem/ChatItem';
import { resetPortalView } from '../Portal';
import { ToolAccordion } from './ToolAccordion';

const styles = createStaticStyles(({ css, cssVar }) => ({
  councilBar: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    height: 48px;
    padding-block: 8px;
  `,
  councilColumn: css`
    flex: 1;
    min-width: 280px;
    max-width: 420px;
    padding: 8px;
    border-inline-end: 1px solid ${cssVar.colorBorderSecondary};

    &:last-child {
      border-inline-end: none;
    }
  `,
  compressedCard: css`
    margin-block-end: 8px;
    padding-block: 8px;
    padding-inline: 12px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 12px;
    background: ${cssVar.colorBgContainer};
  `,
  verifyCard: css`
    margin-block: 8px;
    padding: 12px 14px;
    border-radius: 16px;
    border: 1px solid ${cssVar.colorBorderSecondary};
  `,
  shiny: css`
    background: linear-gradient(
      90deg,
      ${cssVar.colorTextQuaternary} 0%,
      ${cssVar.colorText} 50%,
      ${cssVar.colorTextQuaternary} 100%
    );
    background-size: 200% 100%;
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    animation: shine 1.6s linear infinite;

    @keyframes shine {
      0% {
        background-position: 200% 0;
      }
      100% {
        background-position: -200% 0;
      }
    }
  `,
}));

function SupervisorContentBlocks({
  blocks,
  topicId,
}: {
  blocks: NonNullable<Message['children']>;
  topicId: string;
}) {
  return (
    <Flexbox gap={12}>
      {blocks.map((block) => (
        <Flexbox gap={8} key={block.id}>
          {block.content ? <Markdown>{block.content}</Markdown> : null}
          {block.tools?.map((tool) => (
            <ToolAccordion
              assistantMessageId={block.id}
              id={`${block.id}-${tool.id}`}
              key={tool.id ?? tool.toolCallId}
              tool={tool}
              topicId={topicId}
            />
          ))}
        </Flexbox>
      ))}
    </Flexbox>
  );
}

/** §C.37 supervisor */
export const SupervisorMessageView = memo(function SupervisorMessageView({
  message,
  topicId,
}: {
  message: Message;
  topicId: string;
}) {
  const [collapsed, setCollapsed] = useState(message.metadata?.collapsed ?? false);
  const preview =
    message.content ||
    message.children?.[0]?.content?.slice(0, 300) ||
    '已接管本轮对话，正在协调子 Agent 执行任务…';

  return (
    <ChatItem
      data-msg-type="supervisor"
      id={message.id}
      placement="left"
      showBubble={false}
      time={formatMessageTime(message.createdAt)}
      titleAddon={
        <Tag size="small">
          <Icon icon={Users} size={12} />
          <span>督导</span>
        </Tag>
      }
    >
      {message.children?.length ? (
        collapsed ? (
          <Flexbox gap={8}>
            <Text type="secondary">{preview}</Text>
            <Button size="small" type="text" onClick={() => setCollapsed(false)}>
              展开
            </Button>
          </Flexbox>
        ) : (
          <Flexbox gap={8}>
            <SupervisorContentBlocks blocks={message.children} topicId={topicId} />
            <Button size="small" type="text" onClick={() => setCollapsed(true)}>
              收起
            </Button>
          </Flexbox>
        )
      ) : (
        <Text>{message.content}</Text>
      )}
    </ChatItem>
  );
});

/** §C.37 agentCouncil */
export const AgentCouncilMessageView = memo(function AgentCouncilMessageView({
  message,
  topicId,
}: {
  message: Message;
  topicId: string;
}) {
  const [displayMode, setDisplayMode] = useState<'horizontal' | 'tab'>('horizontal');
  const [activeTab, setActiveTab] = useState(0);
  const members = message.members ?? [];
  if (members.length === 0) return null;

  const councilMember = (member: Message, index: number) => (
    <div className={styles.councilColumn} key={member.id}>
      <ChatItem
        id={member.id}
        placement="left"
        showBubble={false}
        time={formatMessageTime(member.createdAt)}
        titleAddon={<Text weight={600}>{member.agentId ?? `Agent ${index + 1}`}</Text>}
      >
        <Markdown>{member.content}</Markdown>
        {member.tools?.map((tool) => (
          <ToolAccordion
            assistantMessageId={member.id}
            id={`${member.id}-${tool.id}`}
            key={tool.id ?? tool.toolCallId}
            tool={tool}
            topicId={topicId}
          />
        ))}
      </ChatItem>
    </div>
  );

  return (
    <Flexbox data-msg-type="agentCouncil" gap={8} id={message.id}>
      <div className={styles.councilBar}>
        {displayMode === 'tab' ? (
          <Segmented
            options={members.map((_, idx) => ({
              icon: <Icon icon={Bot} size={14} />,
              value: idx,
            }))}
            size="small"
            value={activeTab}
            onChange={(value) => setActiveTab(Number(value))}
          />
        ) : (
          <span />
        )}
        <Segmented
          options={[
            { icon: <Icon icon={Columns2} size={14} />, value: 'horizontal' },
            { icon: <Icon icon={Layers} size={14} />, value: 'tab' },
          ]}
          size="small"
          value={displayMode}
          onChange={(value) => setDisplayMode(value as 'horizontal' | 'tab')}
        />
      </div>
      {displayMode === 'tab' ? (
        councilMember(members[activeTab]!, activeTab)
      ) : (
        <Flexbox horizontal style={{ overflowX: 'auto' }}>
          {members.map((member, index) => councilMember(member, index))}
        </Flexbox>
      )}
    </Flexbox>
  );
});

/** §C.37 verify */
export const VerifyMessageView = memo(function VerifyMessageView({
  message,
  verifyOrdinal,
}: {
  message: Message;
  verifyOrdinal?: number;
}) {
  const state = getVerifyState(message.verifyOperationId);
  const phase = state?.verifyStatus ?? 'pending';
  const round = state?.verifyRound ?? verifyOrdinal ?? 1;

  const phaseColor =
    phase === 'passed'
      ? cssVar.colorSuccess
      : phase === 'failed'
        ? cssVar.colorError
        : cssVar.colorWarning;

  const StatusIcon =
    phase === 'passed' ? ShieldCheck : phase === 'failed' ? ShieldAlert : Shield;

  const handleOpen = () => {
    resetPortalView('VerifyResult', {
      title: message.verifyTitle ?? `验证结果 #${round}`,
      assertion: message.verifyAssertion,
      operationId: message.verifyOperationId,
    });
  };

  return (
    <Block
      className={styles.verifyCard}
      data-msg-type="verify"
      id={message.id}
      padding={0}
      style={{ background: cssVar.colorFillTertiary }}
      variant="filled"
    >
      <Flexbox gap={10} padding={12}>
        <Flexbox horizontal align="center" justify="space-between">
          <Flexbox horizontal align="center" gap={8}>
            <Tag size="small">Round {round}</Tag>
            <StatusIcon color={phaseColor} size={16} />
            <Text weight={600}>{message.verifyTitle ?? '验证计划'}</Text>
          </Flexbox>
          <Button size="small" type="text" onClick={handleOpen}>
            详情
          </Button>
        </Flexbox>
        {message.verifyAssertion ? (
          <Text fontSize={13} type="secondary">
            {message.verifyAssertion}
          </Text>
        ) : null}
        {state?.verifyPlan?.length ? (
          <Flexbox gap={6}>
            {state.verifyPlan.slice(0, 3).map((item) => (
              <Flexbox horizontal align="center" gap={8} key={item.id}>
                {item.status === 'passed' ? (
                  <Check color={cssVar.colorSuccess} size={14} />
                ) : item.status === 'failed' ? (
                  <X color={cssVar.colorError} size={14} />
                ) : (
                  <Shield color={cssVar.colorTextQuaternary} size={14} />
                )}
                <Text fontSize={12}>{item.label}</Text>
              </Flexbox>
            ))}
          </Flexbox>
        ) : null}
      </Flexbox>
    </Block>
  );
});

/** §C.37 compressedGroup */
export const CompressedGroupMessageView = memo(function CompressedGroupMessageView({
  message,
  topicId,
}: {
  message: Message;
  topicId: string;
}) {
  const activeTopicId = useTopicStore((s) => s.activeTopicId);
  const resolvedTopicId = topicId || activeTopicId;
  const toggleStore = useCompressionUiStore((s) => s.toggleExpanded);
  const setActiveTab = useCompressionUiStore((s) => s.setActiveTab);
  const getActiveTab = useCompressionUiStore((s) => s.getActiveTab);
  const isExpandedStore = useCompressionUiStore((s) => s.isExpanded);
  const toggleCompressed = useChatStore((s) => s.toggleCompressedGroupExpanded);
  const cancelCompression = useChatStore((s) => s.cancelCompression);

  const expanded = isExpandedStore(message.id, message.compressedExpanded ?? true);
  const activeTab = getActiveTab(message.id);
  const isGenerating = Boolean(message.isGeneratingSummary);
  const summary = message.compressedSummary || message.content;
  const history = message.compressedMessages ?? [];

  const tabItems = useMemo(
    () => [
      {
        key: 'summary',
        label: (
          <Flexbox horizontal align="center" gap={6}>
            <Sparkles size={14} />
            <span>摘要</span>
          </Flexbox>
        ),
        children: <Markdown>{summary}</Markdown>,
      },
      {
        key: 'history',
        label: (
          <Flexbox horizontal align="center" gap={6}>
            <History size={14} />
            <span>历史</span>
          </Flexbox>
        ),
        children: (
          <Flexbox className={styles.compressedCard} gap={8} style={{ border: 'none', padding: 0 }}>
            {history.map((item) => (
              <ChatItem
                id={item.id}
                key={item.id}
                placement={item.role === 'user' ? 'right' : 'left'}
                showBubble={item.role === 'user'}
                time={formatMessageTime(item.createdAt)}
              >
                <Markdown>{item.content}</Markdown>
              </ChatItem>
            ))}
          </Flexbox>
        ),
      },
    ],
    [history, summary],
  );

  const handleToggleExpand = () => {
    toggleStore(message.id);
    toggleCompressed(resolvedTopicId, message.id);
  };

  const handleCancel = () => {
    confirmModal({
      title: '撤销压缩',
      content: '确定撤销此次历史压缩？原始消息将恢复显示。',
      onOk: () => {
        cancelCompression(resolvedTopicId, message.id);
        showToast('已撤销压缩');
      },
    });
  };

  return (
    <div className={styles.compressedCard} data-msg-type="compressedGroup" id={message.id}>
      {isGenerating ? (
        <Flexbox gap={8}>
          <Text className={styles.shiny}>正在压缩历史…</Text>
          <Markdown>{summary || '…'}</Markdown>
        </Flexbox>
      ) : (
        <>
          <Flexbox horizontal align="center" justify="space-between">
            <Tabs
              activeKey={activeTab}
              compact
              items={tabItems}
              onChange={(key) => setActiveTab(message.id, key as 'summary' | 'history')}
            />
            <Flexbox horizontal gap={4}>
              <ActionIcon icon={Undo2} size="small" title="撤销压缩" onClick={handleCancel} />
              <ActionIcon
                icon={expanded ? ChevronUp : ChevronDown}
                size="small"
                title={expanded ? '收起' : '展开'}
                onClick={handleToggleExpand}
              />
            </Flexbox>
          </Flexbox>
          {expanded ? (
            <div style={{ maxHeight: 'min(40vh, 400px)', overflow: 'auto', paddingTop: 8 }}>
              {activeTab === 'summary' ? <Markdown>{summary}</Markdown> : tabItems[1]?.children}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
});
