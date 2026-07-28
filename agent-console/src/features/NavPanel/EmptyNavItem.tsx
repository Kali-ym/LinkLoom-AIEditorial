import { Block, Center, Icon, Text } from '@lobehub/ui';
import { PlusIcon } from 'lucide-react';
import { memo } from 'react';

interface EmptyNavItemProps {
  className?: string;
  disabled?: boolean;
  onClick: () => void;
  title: string;
}

/** §C.51*/
export const EmptyNavItem = memo(function EmptyNavItem({
  title,
  onClick,
  className,
  disabled,
}: EmptyNavItemProps) {
  return (
    <Block
      horizontal
      align="center"
      className={className}
      clickable={!disabled}
      gap={8}
      height={32}
      paddingInline={2}
      style={disabled ? { cursor: 'not-allowed', opacity: 0.5 } : undefined}
      variant="borderless"
      onClick={disabled ? undefined : onClick}
    >
      <Center flex="none" height={28} width={28}>
        <Icon icon={PlusIcon} size="small" />
      </Center>
      <Text align="center" type="secondary">
        {title}
      </Text>
    </Block>
  );
});
