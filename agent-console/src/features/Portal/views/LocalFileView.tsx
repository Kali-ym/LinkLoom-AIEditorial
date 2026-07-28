import { Empty, Flexbox, Markdown, Segmented, SyntaxHighlighter } from '@lobehub/ui';
import { memo } from 'react';

import type { PortalViewPayload } from '../../../domain/types/portalView';
import { usePortalViewUiStore, useWorkspaceStore } from '../../../stores';
import { portalViewStyles } from '../portalViewStyles';

/** §C.21 LocalFile Body*/
export const LocalFileView = memo(function LocalFileView({ payload }: { payload: PortalViewPayload }) {
  const defaultTabs = useWorkspaceStore((s) => s.portalContent.localFileTabs);
  const tabs = payload.localFileTabs ?? defaultTabs;
  const mode = usePortalViewUiStore((s) => s.localFilePreviewMode);
  const setMode = usePortalViewUiStore((s) => s.setLocalFilePreviewMode);
  const activeTab = usePortalViewUiStore((s) => s.activeLocalFileTab);
  const tab = tabs[activeTab] ?? tabs[0];

  if (!tab) {
    return (
      <Flexbox align="center" flex={1} justify="center">
        <Empty description="无法打开本地文件" />
      </Flexbox>
    );
  }

  const isMarkdown = tab.label.endsWith('.md');

  return (
    <Flexbox className={portalViewStyles.bodyRoot} flex={1} gap={8} style={{ minHeight: 0 }}>
      {isMarkdown ? (
        <Segmented
          options={[
            { label: '渲染', value: 'render' },
            { label: '原始', value: 'raw' },
            { label: '源码', value: 'source' },
          ]}
          value={mode}
          onChange={(value) => setMode(value as 'render' | 'raw' | 'source')}
        />
      ) : null}

      <div className={portalViewStyles.frontmatterCard} style={{ margin: '8px 12px 12px' }}>
        <div className={portalViewStyles.metadataRow}>
          <span className={portalViewStyles.metadataKey}>path</span>
          <span>{tab.label}</span>
        </div>
      </div>

      <Flexbox className={portalViewStyles.scrollBody} flex={1} paddingInline={12}>
        {mode === 'render' && isMarkdown ? (
          <Markdown enableHtmlPreview variant="chat">
            {tab.content}
          </Markdown>
        ) : (
          <SyntaxHighlighter language="markdown" style={{ fontSize: 12 }} variant="borderless">
            {tab.content}
          </SyntaxHighlighter>
        )}
      </Flexbox>
    </Flexbox>
  );
});
