import { Block, Icon } from '@lobehub/ui';
import { cssVar } from 'antd-style';
import { AtomIcon, Loader2Icon } from 'lucide-react';
import { memo } from 'react';

/** §C.3 Thinking StatusIndicator — Block 24×24 outlined */
export const ThinkingStatusIndicator = memo(function ThinkingStatusIndicator({
  showDetail,
  thinking,
}: {
  showDetail?: boolean;
  thinking?: boolean;
}) {
  const icon = thinking ? (
    <Icon spin color={cssVar.colorTextDescription} icon={Loader2Icon} />
  ) : (
    <Icon color={showDetail ? cssVar.purple : cssVar.colorTextDescription} icon={AtomIcon} />
  );

  return (
    <Block
      horizontal
      align="center"
      flex="none"
      height={24}
      justify="center"
      variant="outlined"
      width={24}
      style={{ fontSize: 12 }}
    >
      {icon}
    </Block>
  );
});
