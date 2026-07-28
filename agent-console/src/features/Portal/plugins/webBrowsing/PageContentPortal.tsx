import { Alert, CopyButton, Flexbox, Icon, Markdown, Segmented, Text } from '@lobehub/ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { ExternalLink } from 'lucide-react';
import { memo, useState } from 'react';

import { resolveCrawlResult } from '../../../../hooks/data/useToolPortal';
import type { ToolPortalProps } from '../../types';

const styles = createStaticStyles(({ css }) => ({
  meta: css`
    font-size: 12px;
    color: ${cssVar.colorTextSecondary};
  `,
}));

type DisplayMode = 'preview' | 'raw';

export const PageContentPortalBody = memo(function PageContentPortalBody({
  payload,
}: ToolPortalProps) {
  const page = resolveCrawlResult(payload);
  const [mode, setMode] = useState<DisplayMode>('preview');
  const content = mode === 'raw' ? page.rawContent ?? page.content ?? '' : page.content ?? '';

  if (page.error) {
    return <Alert showIcon title="抓取失败" type="error" description={page.error} />;
  }

  return (
    <Flexbox gap={12}>
      <Flexbox gap={4}>
        <Text style={{ fontSize: 16, fontWeight: 600 }}>{page.title}</Text>
        {page.description ? (
          <Text className={styles.meta} ellipsis={{ rows: 2 }}>
            {page.description}
          </Text>
        ) : null}
        <Flexbox horizontal align="center" gap={6} className={styles.meta}>
          <a href={page.url} rel="noreferrer" target="_blank">
            {page.url}
          </a>
          <Icon icon={ExternalLink} size={12} />
          {page.siteName ? <span>· {page.siteName}</span> : null}
          {page.wordCount ? <span>· {page.wordCount} 字</span> : null}
        </Flexbox>
      </Flexbox>
      <Flexbox horizontal align="center" justify="space-between">
        <Segmented
          options={[
            { label: 'Preview', value: 'preview' },
            { label: 'Raw', value: 'raw' },
          ]}
          value={mode}
          variant="filled"
          onChange={(v) => setMode(v as DisplayMode)}
        />
        <CopyButton content={content} size="small" />
      </Flexbox>
      {mode === 'preview' ? (
        <Markdown variant="chat">{content}</Markdown>
      ) : (
        <Text style={{ whiteSpace: 'pre-wrap', fontFamily: cssVar.fontFamilyCode, fontSize: 12 }}>
          {content}
        </Text>
      )}
      {content.length > 4000 ? (
        <Alert showIcon type="info" variant="borderless" title="内容已截断展示" />
      ) : null}
    </Flexbox>
  );
});
