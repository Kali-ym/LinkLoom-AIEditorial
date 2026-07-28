import { ActionIcon, Avatar, Flexbox, Segmented, Tag, Text } from '@lobehub/ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { ArrowLeft, ArrowLeftRight, ListTree, X } from 'lucide-react';
import { memo } from 'react';

import { resolveToolUIPayload } from '../../../hooks/data/usePortal';
import { DESKTOP_HEADER_ICON_SMALL_SIZE } from '../../../constants/layoutTokens';
import type { PortalViewPayload } from '../../../domain/types/portalView';
import { usePortalStore, usePortalViewUiStore, useWorkspaceStore } from '../../../stores';
import { NavHeader } from '../../NavHeader';
import { portalStrings } from '../portalStrings';
import { portalChromeStyles } from '../portalChromeStyles';
import { portalViewStyles } from '../portalViewStyles';
import { resolveToolPortalActions, resolveToolPortalTitle } from '../toolPortalRegistry';

const headerStyles = createStaticStyles(({ css }) => ({
  toolTitle: css`
    font-size: 16px;
    color: ${cssVar.colorTextSecondary};
  `,
}));

/** §C.21 LocalFile 自定义 Header */
export const LocalFileHeader = memo(function LocalFileHeader({
  payload,
}: {
  payload: PortalViewPayload;
}) {
  const defaultTabs = useWorkspaceStore((s) => s.portalContent.localFileTabs);
  const tabs = payload.localFileTabs ?? defaultTabs;
  const activeTab = usePortalViewUiStore((s) => s.activeLocalFileTab);
  const setActiveTab = usePortalViewUiStore((s) => s.setActiveLocalFileTab);
  const goBack = usePortalStore((s) => s.goBackPortal);
  const clear = usePortalStore((s) => s.clearPortalStack);
  const canGoBack = usePortalStore((s) => s.stack.length > 1);

  return (
    <NavHeader
      showTogglePanelButton={false}
      className={portalChromeStyles.headerShell}
      style={{ padding: '0 8px 0 0' }}
      left={
        <Flexbox horizontal align="center" gap={4} style={{ minWidth: 0, flex: 1 }}>
          {canGoBack && (
            <ActionIcon
              icon={ArrowLeft}
              size={DESKTOP_HEADER_ICON_SMALL_SIZE}
              title="返回"
              onClick={goBack}
            />
          )}
          <Flexbox horizontal gap={4} style={{ minWidth: 0, overflow: 'auto' }}>
            {tabs.map((tab, index) => (
              <button
                key={tab.label}
                className={portalViewStyles.localFileTab}
                data-active={activeTab === index}
                type="button"
                onClick={() => setActiveTab(index)}
              >
                {tab.label}
                {tab.dirty ? <span className={portalViewStyles.dirtyDot} /> : null}
              </button>
            ))}
          </Flexbox>
        </Flexbox>
      }
      right={
        <ActionIcon
          icon={X}
          size={DESKTOP_HEADER_ICON_SMALL_SIZE}
          title="关闭"
          onClick={clear}
        />
      }
    />
  );
});

/** §C.21 ToolUI 自定义 Header */
export const ToolUIHeader = memo(function ToolUIHeader({ payload }: { payload: PortalViewPayload }) {
  const p = resolveToolUIPayload(payload);
  const clear = usePortalStore((s) => s.clearPortalStack);
  const actions = resolveToolPortalActions(payload);
  const TitleComponent = resolveToolPortalTitle(payload);

  return (
    <NavHeader
      showTogglePanelButton={false}
      className={portalChromeStyles.headerShell}
      style={{ paddingBlock: 8, paddingInline: 8 }}
      left={
        TitleComponent ? (
          <TitleComponent payload={payload} />
        ) : (
          <Flexbox horizontal align="center" gap={8} style={{ minWidth: 0 }}>
            <Avatar avatar={p.plugin} shape="square" size={28} />
            <Text className={headerStyles.toolTitle} ellipsis>
              {p.plugin} › {p.api}
            </Text>
          </Flexbox>
        )
      }
      right={
        <>
          {actions}
          <ActionIcon
            icon={X}
            size={DESKTOP_HEADER_ICON_SMALL_SIZE}
            title={portalStrings.common.close}
            onClick={clear}
          />
        </>
      }
    />
  );
});

/** §C.21 Thread 自定义 Header */
export const ThreadHeader = memo(function ThreadHeader({ payload }: { payload: PortalViewPayload }) {
  const clear = usePortalStore((s) => s.clearPortalStack);
  const isSubagent = payload.isSubagent ?? false;
  const title = payload.title || '分支对话';
  const threadMode = usePortalViewUiStore((s) => s.threadCreationMode);
  const setThreadMode = usePortalViewUiStore((s) => s.setThreadCreationMode);

  return (
    <NavHeader
      showTogglePanelButton={false}
      className={portalChromeStyles.headerShell}
      style={{ padding: '6px 8px' }}
      left={
        <Flexbox horizontal align="center" gap={8} style={{ minWidth: 0, flex: 1 }}>
          <ListTree size={18} style={{ color: cssVar.colorTextSecondary, flexShrink: 0 }} />
          <Text ellipsis fontSize={14} type="secondary">
            {title}
          </Text>
          {isSubagent && payload.agentName ? (
            <Tag style={{ fontSize: 11 }}>{payload.agentName}</Tag>
          ) : null}
        </Flexbox>
      }
      right={
        <Flexbox horizontal align="center" gap={4}>
          <ActionIcon
            icon={ArrowLeftRight}
            size={DESKTOP_HEADER_ICON_SMALL_SIZE}
            title="切换主会话"
            onClick={clear}
          />
          {!isSubagent && (
            <Segmented
              size="small"
              options={[
                { label: 'Continuation', value: 'continuation' },
                { label: 'Standalone', value: 'standalone' },
              ]}
              value={threadMode}
              onChange={(value) => setThreadMode(value as 'continuation' | 'standalone')}
            />
          )}
          <ActionIcon
            icon={X}
            size={DESKTOP_HEADER_ICON_SMALL_SIZE}
            title="关闭"
            onClick={clear}
          />
        </Flexbox>
      }
    />
  );
});

/** §C.21 GroupThread 自定义 Header */
export const GroupThreadHeader = memo(function GroupThreadHeader({
  payload,
}: {
  payload: PortalViewPayload;
}) {
  const clear = usePortalStore((s) => s.clearPortalStack);
  const setActiveThreadAgentId = usePortalViewUiStore((s) => s.setActiveThreadAgentId);
  const title = payload.title || payload.agentName || '分组分支';

  return (
    <NavHeader
      showTogglePanelButton={false}
      className={portalChromeStyles.headerShell}
      style={{ padding: '6px 8px' }}
      left={
        <Flexbox horizontal align="center" gap={8} style={{ minWidth: 0 }}>
          <Avatar avatar={payload.agentAvatar} shape="square" size={20} />
          <Text ellipsis style={{ fontWeight: 600 }}>
            {title}
          </Text>
        </Flexbox>
      }
      right={
        <ActionIcon
          icon={X}
          size={DESKTOP_HEADER_ICON_SMALL_SIZE}
          title={portalStrings.common.close}
          onClick={() => {
            setActiveThreadAgentId('');
            clear();
          }}
        />
      }
    />
  );
});
