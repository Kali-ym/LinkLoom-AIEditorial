import { Flexbox, Text } from '@lobehub/ui';
import { memo, type ReactNode } from 'react';

interface DeferEmptyStateProps {
  title: string;
  hint: string;
  children?: ReactNode;
}

export const DeferEmptyState = memo(function DeferEmptyState({
  title,
  hint,
  children,
}: DeferEmptyStateProps) {
  return (
    <Flexbox gap={8}>
      <Text strong>{title}</Text>
      <Text type="secondary">{hint}</Text>
      {children}
    </Flexbox>
  );
});
