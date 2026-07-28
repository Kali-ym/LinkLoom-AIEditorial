import { Icon, Tooltip } from '@lobehub/ui';
import { CircleHelp } from 'lucide-react';
import { memo, type ReactNode } from 'react';

/** Upstream `@/components/InfoTooltip` 薄封装 — 参数说明等 */
export const InfoTooltip = memo(function InfoTooltip({
  title,
}: {
  title: ReactNode;
}) {
  return (
    <Tooltip title={title}>
      <span style={{ display: 'inline-flex', lineHeight: 0 }}>
        <Icon icon={CircleHelp} size={14} style={{ color: 'var(--console-vars-color-text-tertiary)' }} />
      </span>
    </Tooltip>
  );
});
