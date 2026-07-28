import { Avatar, Flexbox, Icon, Text } from '@lobehub/ui';
import { ProviderIcon } from '@lobehub/ui/icons';
import { memo } from 'react';

interface ProviderItemRenderProps {
  logo?: string;
  name: string;
  provider: string;
  size?: number;
}

/** §C.42*/
export const ProviderItemRender = memo(function ProviderItemRender({
  logo,
  name,
  size = 16,
}: ProviderItemRenderProps) {
  return (
    <Flexbox horizontal align="center" gap={6} style={{ minWidth: 0 }}>
      {logo ? (
        <Avatar avatar={logo} shape="square" size={size} />
      ) : (
        <Icon icon={ProviderIcon} size={size} />
      )}
      <Text ellipsis style={{ fontSize: 12 }}>
        {name}
      </Text>
    </Flexbox>
  );
});
