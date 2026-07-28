import { Flexbox, Icon, Text } from '@lobehub/ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { Globe, SlidersHorizontal } from 'lucide-react';
import { memo } from 'react';

import { resolveVerifyPlanState } from '../../../hooks/data/useToolPortal';
import type { PortalViewPayload } from '../../../domain/types/portalView';
import { webBrowsingTitle } from './webBrowsing';

const styles = createStaticStyles(({ css }) => ({
  title: css`
    font-size: 16px;
    color: ${cssVar.colorTextSecondary};
  `,
  badge: css`
    font-size: 12px;
    padding: 2px 8px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 999px;
    background: ${cssVar.colorFillSecondary};
    color: ${cssVar.colorTextSecondary};
  `,
}));

export const WebBrowsingPortalTitle = memo(function WebBrowsingPortalTitle({
  payload,
}: {
  payload: PortalViewPayload;
}) {
  return (
    <Flexbox horizontal align="center" gap={8}>
      <Icon icon={Globe} size={16} />
      <Text className={styles.title}>{webBrowsingTitle(payload)}</Text>
    </Flexbox>
  );
});

export const DeliveryCheckerPortalTitle = memo(function DeliveryCheckerPortalTitle({
  payload,
}: {
  payload: PortalViewPayload;
}) {
  const params = payload.toolUIParams;
  const plan = resolveVerifyPlanState(payload);
  const total = plan.items?.length ?? 0;
  const index = typeof params?.index === 'number' ? params.index : 0;
  const isRubric = params?.view === 'rubric';
  const title = isRubric
    ? plan.rubricName ?? 'Rubric 配置'
    : plan.items?.[index]?.title ?? '验收标准';

  return (
    <Flexbox horizontal align="center" gap={8} style={{ minWidth: 0 }}>
      <Icon icon={SlidersHorizontal} size={16} />
      <Text className={styles.title} ellipsis>
        {title}
      </Text>
      {!isRubric && total > 0 ? (
        <span className={styles.badge}>
          #{index + 1}/{total}
        </span>
      ) : null}
    </Flexbox>
  );
});
