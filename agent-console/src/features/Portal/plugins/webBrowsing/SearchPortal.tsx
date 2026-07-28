import { Flexbox, Icon, SearchBar, Skeleton, Tag, Text } from '@lobehub/ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { ExternalLink } from 'lucide-react';
import { memo } from 'react';

import { resolveSearchState } from '../../../../hooks/data/useToolPortal';
import type { ToolPortalProps } from '../../types';

const styles = createStaticStyles(({ css }) => ({
  resultRow: css`
    padding: 10px 12px;
    border-radius: ${cssVar.borderRadius};
    cursor: pointer;
    transition: background 0.2s;

    &:hover {
      background: ${cssVar.colorFillTertiary};
    }
  `,
}));

export const SearchPortalBody = memo(function SearchPortalBody({ payload }: ToolPortalProps) {
  const query = String(payload.args?.query ?? '');
  const { loading, results = [] } = resolveSearchState(payload);

  return (
    <Flexbox gap={12} style={{ height: '100%' }}>
      <SearchBar
        placeholder="搜索…"
        style={{ minWidth: 280, width: '100%' }}
        value={query}
        onSearch={() => undefined}
      />
      {loading ? (
        <Flexbox gap={16} paddingBlock={8} paddingInline={12}>
          {[1, 2, 3, 4, 5].map((id) => (
            <Skeleton
              active
              key={id}
              paragraph={{ rows: 3, width: `${(id % 4) + 5}0%` }}
              title={false}
            />
          ))}
        </Flexbox>
      ) : (
        <Flexbox flex={1} gap={4} style={{ overflow: 'auto' }}>
          {results.map((item) => (
            <a
              key={item.url}
              className={styles.resultRow}
              href={item.url}
              rel="noreferrer"
              target="_blank"
            >
              <Flexbox gap={4}>
                <Flexbox horizontal align="center" gap={6}>
                  <Text ellipsis style={{ fontWeight: 600 }}>
                    {item.title}
                  </Text>
                  {item.score != null && item.score >= 0.8 ? (
                    <Tag color="blue" size="small" variant="filled">
                      {Math.round(item.score * 100)}%
                    </Tag>
                  ) : null}
                  <Icon icon={ExternalLink} size={12} style={{ flexShrink: 0, opacity: 0.5 }} />
                </Flexbox>
                <Text ellipsis type="secondary" style={{ fontSize: 12 }}>
                  {item.url}
                </Text>
                {item.snippet ? (
                  <Text type="secondary" style={{ fontSize: 12, lineHeight: 1.5 }}>
                    {item.snippet}
                  </Text>
                ) : null}
              </Flexbox>
            </a>
          ))}
        </Flexbox>
      )}
    </Flexbox>
  );
});
