import { ActionIcon, Tooltip } from '@lobehub/ui';
import { Maximize2Icon, Minimize2Icon } from 'lucide-react';
import { memo, useCallback } from 'react';

import { usePermission } from '../../hooks/usePermission';
import { useInputStore } from '../../stores';

/** §C.18 Expand*/
export const ExpandButton = memo(function ExpandButton() {
  const inputExpanded = useInputStore((s) => s.inputExpanded);
  const setInputExpanded = useInputStore((s) => s.setInputExpanded);
  const { allowed: canExpand, reason } = usePermission('create_content');

  const toggle = useCallback(() => {
    if (!canExpand) return;
    setInputExpanded(!inputExpanded);
  }, [canExpand, inputExpanded, setInputExpanded]);

  const label = canExpand ? (inputExpanded ? '退出全屏' : '全屏编辑') : reason;

  return (
    <Tooltip title={label}>
      <span className="show-on-hover" style={{ display: 'inline-flex', zIndex: 10 }}>
        <ActionIcon
          disabled={!canExpand}
          icon={inputExpanded ? Minimize2Icon : Maximize2Icon}
          size={{ blockSize: 32, size: 16, strokeWidth: 2.3 }}
          onClick={toggle}
        />
      </span>
    </Tooltip>
  );
});
