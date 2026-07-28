import { Flexbox, Text } from '@lobehub/ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { memo, useCallback } from 'react';

import { resolveCrawlMultiState } from '../../../../hooks/data/useToolPortal';
import { openToolUI } from '../../portalActions';
import type { ToolPortalProps } from '../../types';
import { PageContentPortalBody } from './PageContentPortal';

const styles = createStaticStyles(({ css }) => ({
  tab: css`
    padding: 6px 10px;
    border-radius: ${cssVar.borderRadius};
    border: 1px solid ${cssVar.colorBorderSecondary};
    cursor: pointer;
    font-size: 12px;
    white-space: nowrap;

    &[data-active='true'] {
      border-color: ${cssVar.colorPrimary};
      background: ${cssVar.colorFillTertiary};
    }
  `,
}));

export const PageContentsPortalBody = memo(function PageContentsPortalBody({
  payload,
}: ToolPortalProps) {
  const multi = resolveCrawlMultiState(payload);
  const activeUrl = multi.activePageContentUrl ?? multi.results?.[0]?.url;

  const selectUrl = useCallback(
    (url: string) => {
      openToolUI({
        ...payload,
        pluginState: { ...multi, activePageContentUrl: url },
      });
    },
    [multi, payload],
  );

  const activePage = multi.results?.find((r) => r.url === activeUrl);

  return (
    <Flexbox gap={12} style={{ height: '100%' }}>
      <Flexbox horizontal gap={6} style={{ overflow: 'auto', flexShrink: 0 }}>
        {(multi.results ?? []).map((page) => (
          <button
            key={page.url}
            className={styles.tab}
            data-active={page.url === activeUrl}
            type="button"
            onClick={() => selectUrl(page.url)}
          >
            {page.title ?? page.url}
          </button>
        ))}
      </Flexbox>
      {activePage ? (
        <PageContentPortalBody
          payload={{
            ...payload,
            args: { ...payload.args, url: activePage.url },
            url: activePage.url,
            result: activePage.content,
            pluginState: { results: [activePage] },
          }}
        />
      ) : (
        <Text type="secondary">选择页面查看内容</Text>
      )}
    </Flexbox>
  );
});
