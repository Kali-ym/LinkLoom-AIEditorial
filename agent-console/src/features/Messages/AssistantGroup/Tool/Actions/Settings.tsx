import { ActionIcon } from '@lobehub/ui';
import { Settings as LucideSettings } from 'lucide-react';
import { memo } from 'react';

import { toolActionStrings } from './toolActionStrings';

/** §C.26 Settings — schema 非空时渲染 */
export const ToolSettingsAction = memo(function ToolSettingsAction({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <ActionIcon
      icon={LucideSettings}
      size="small"
      title={toolActionStrings.setting}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    />
  );
});
