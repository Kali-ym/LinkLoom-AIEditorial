import { ActionIcon, Flexbox, Segmented, Text } from '@lobehub/ui';
import { ArrowLeft } from 'lucide-react';
import { memo } from 'react';

import { DESKTOP_HEADER_ICON_SMALL_SIZE } from '../../../constants/layoutTokens';
import type { PortalViewPayload } from '../../../domain/types/portalView';
import { usePortalStore, usePortalViewUiStore } from '../../../stores';

export const HomeTitle = memo(function HomeTitle(_props: { payload: PortalViewPayload }) {
  return (
    <Text ellipsis fontSize={16} type="secondary">
      工作区
    </Text>
  );
});

export const ArtifactTitle = memo(function ArtifactTitle({ payload }: { payload: PortalViewPayload }) {
  const mode = usePortalViewUiStore((s) => s.artifactDisplayMode);
  const setMode = usePortalViewUiStore((s) => s.setArtifactDisplayMode);
  const goBack = usePortalStore((s) => s.goBackPortal);

  return (
    <Flexbox horizontal align="center" gap={8} style={{ minWidth: 0, flex: 1 }}>
      <ActionIcon
        icon={ArrowLeft}
        size={DESKTOP_HEADER_ICON_SMALL_SIZE}
        title="返回"
        onClick={goBack}
      />
      <Text ellipsis fontSize={16} style={{ flex: 1, minWidth: 0 }} type="secondary">
        {payload.title || 'Artifact'}
      </Text>
      <Segmented
        size="small"
        style={{ flexShrink: 0, fontSize: 12 }}
        value={mode}
        options={[
          { label: '预览', value: 'preview' },
          { label: '代码', value: 'code' },
        ]}
        onChange={(value) => setMode(value as 'preview' | 'code')}
      />
    </Flexbox>
  );
});

export const DocumentTitle = memo(function DocumentTitle({ payload }: { payload: PortalViewPayload }) {
  return (
    <Text ellipsis fontSize={16} type="secondary">
      {payload.title || '文档'}
    </Text>
  );
});

export const NotebookTitle = memo(function NotebookTitle(_props: { payload: PortalViewPayload }) {
  return (
    <Text ellipsis fontSize={16} type="secondary">
      笔记本
    </Text>
  );
});

export const FilePreviewTitle = memo(function FilePreviewTitle({
  payload,
}: {
  payload: PortalViewPayload;
}) {
  const clear = usePortalStore((s) => s.clearPortalStack);
  const goBack = usePortalStore((s) => s.goBackPortal);

  return (
    <Flexbox horizontal align="center" gap={8} style={{ minWidth: 0, flex: 1 }}>
      <ActionIcon
        icon={ArrowLeft}
        size={DESKTOP_HEADER_ICON_SMALL_SIZE}
        title="返回"
        onClick={() => {
          if (usePortalStore.getState().stack.length > 1) {
            goBack();
          } else {
            clear();
          }
        }}
      />
      <Text ellipsis fontSize={16} type="secondary">
        {payload.name || payload.path || '文件预览'}
      </Text>
    </Flexbox>
  );
});

export const MessageDetailTitle = memo(function MessageDetailTitle({
  payload,
}: {
  payload: PortalViewPayload;
}) {
  return (
    <Text ellipsis fontSize={16} type="secondary">
      {payload.title || '消息详情'}
    </Text>
  );
});

export const VerifyResultTitle = memo(function VerifyResultTitle({
  payload,
}: {
  payload: PortalViewPayload;
}) {
  const ratio = Math.round((payload.confidence ?? 0.92) * 100);
  const passed = payload.passed ?? true;
  const badgeColor = passed ? 'success' : 'danger';

  return (
    <Flexbox horizontal align="center" gap={8} style={{ minWidth: 0 }}>
      <Text ellipsis fontSize={16} type="secondary">
        {payload.title || `验证结果 #${payload.id ?? ''}`}
      </Text>
      <Text
        style={{
          flexShrink: 0,
          fontSize: 12,
          fontWeight: 600,
          padding: '2px 8px',
          borderRadius: 999,
        }}
        type={badgeColor}
      >
        {passed ? 'passed' : 'failed'} · {ratio}%
      </Text>
    </Flexbox>
  );
});
