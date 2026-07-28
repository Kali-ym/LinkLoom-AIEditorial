import { Text } from '@lobehub/ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { memo } from 'react';

import { useWorkspaceStore } from '../../../stores';
import { resetPortalView } from '../../Portal';
import { ShowcasePanel } from './ShowcasePanel';

const styles = createStaticStyles(({ css }) => ({
  grid: css`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 8px;
  `,
  btn: css`
    padding: 8px 10px;
    border: 1px solid ${cssVar.colorBorder};
    border-radius: 8px;
    background: ${cssVar.colorBgContainer};
    font-size: 12px;
    cursor: pointer;
    text-align: start;

    &:hover {
      background: ${cssVar.colorFillTertiary};
    }
  `,
}));

/** index.html `#portalShowcaseGrid` */
export const PortalShowcase = memo(function PortalShowcase() {
  const portal = useWorkspaceStore((s) => s.showcase.portal);

  return (
    <ShowcasePanel itemKey="portal" title={portal.title}>
      <Text type="secondary" style={{ fontSize: 12, marginBottom: 10, display: 'block' }}>
        对齐 <code>Portal/router.tsx</code>：头部返回 + 关闭，支持 view stack 导航。
      </Text>
      <div className={styles.grid}>
        {portal.entries.map((entry) => (
          <button
            key={entry.type}
            type="button"
            className={styles.btn}
            data-portal-demo={entry.type}
            onClick={() => resetPortalView(entry.type, entry.payload as Record<string, unknown>)}
          >
            {entry.label}
          </button>
        ))}
      </div>
    </ShowcasePanel>
  );
});
