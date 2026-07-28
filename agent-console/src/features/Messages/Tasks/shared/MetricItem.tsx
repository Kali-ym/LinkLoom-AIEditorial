import { Flexbox, Icon, Tag } from '@lobehub/ui';
import { cssVar } from 'antd-style';
import { type LucideIcon } from 'lucide-react';
import { memo, type ReactNode } from 'react';

const separatorStyle = {
  width: 3,
  height: 3,
  borderRadius: '50%',
  background: cssVar.colorTextQuaternary,
} as const;

/** §C.47*/
export const MetricItem = memo(function MetricItem({
  icon,
  label,
  value,
}: {
  icon?: LucideIcon;
  label?: string;
  value: string | number;
}) {
  return (
    <Tag size="small" variant="borderless">
      {icon ? <Icon icon={icon} size={12} /> : null}
      {label ? <span>{label}</span> : null}
      <span>{value}</span>
    </Tag>
  );
});

export const MetricSeparator = memo(function MetricSeparator() {
  return <div style={separatorStyle} />;
});

export const MetricsRow = memo(function MetricsRow({ children }: { children: ReactNode }) {
  return (
    <Flexbox horizontal align="center" gap={12} wrap="wrap">
      {children}
    </Flexbox>
  );
});
