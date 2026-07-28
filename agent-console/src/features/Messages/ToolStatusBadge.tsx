import { Block, Icon } from '@lobehub/ui';
import { cssVar } from 'antd-style';
import {
  AlertTriangle,
  Ban,
  Check,
  HandIcon,
  PauseIcon,
  X,
} from 'lucide-react';
import { memo } from 'react';

import { NeuralNetworkLoading } from '../../components/NeuralNetworkLoading';
import type { ToolState } from '../../domain/types/tool';

/** §C.3 Tool StatusIndicator — Block 24×24 outlined + cssVar 状态色 */
export const ToolStatusBadge = memo(function ToolStatusBadge({
  state = 'success',
}: {
  state?: ToolState | string;
}) {
  let icon = <Icon color={cssVar.colorSuccess} icon={Check} size={14} />;

  if (state === 'executing') {
    icon = <NeuralNetworkLoading size={14} />;
  } else if (state === 'pending') {
    icon = <Icon color={cssVar.colorInfo} icon={HandIcon} size={14} />;
  } else if (state === 'error') {
    icon = <Icon color={cssVar.colorError} icon={X} size={14} />;
  } else if (state === 'warning') {
    icon = <Icon color={cssVar.colorWarning} icon={AlertTriangle} size={14} />;
  } else if (state === 'rejected') {
    icon = <Icon color={cssVar.colorTextTertiary} icon={Ban} size={14} />;
  } else if (state === 'aborted') {
    icon = <Icon color={cssVar.colorTextTertiary} icon={PauseIcon} size={14} />;
  }

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
