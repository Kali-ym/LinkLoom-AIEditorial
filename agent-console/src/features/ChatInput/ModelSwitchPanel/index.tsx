import {
  DropdownMenuPopup,
  DropdownMenuPortal,
  DropdownMenuPositioner,
  DropdownMenuRoot,
  DropdownMenuTrigger,
  stopPropagation,
  TooltipGroup,
} from '@lobehub/ui';
import { memo, useCallback, useState } from 'react';

import { PanelContent } from './components/PanelContent';
import { styles } from './styles';
import type { ModelSwitchPanelProps } from './types';

/** §C.42*/
export const ModelSwitchPanel = memo(function ModelSwitchPanel({
  children,
  enabledList,
  model,
  onModelChange,
  onOpenChange,
  open,
  openOnHover = true,
  placement = 'topLeft',
  provider,
}: ModelSwitchPanelProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setInternalOpen(nextOpen);
      onOpenChange?.(nextOpen);
    },
    [onOpenChange],
  );

  return (
    <TooltipGroup>
      <DropdownMenuRoot open={isOpen} onOpenChange={handleOpenChange}>
        <DropdownMenuTrigger className={styles.trigger} openOnHover={openOnHover}>
          {children}
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuPositioner hoverTrigger={openOnHover} placement={placement}>
            <DropdownMenuPopup className={styles.container} onKeyDown={stopPropagation}>
              <PanelContent
                enabledList={enabledList}
                model={model}
                provider={provider}
                onModelChange={onModelChange}
                onOpenChange={handleOpenChange}
              />
            </DropdownMenuPopup>
          </DropdownMenuPositioner>
        </DropdownMenuPortal>
      </DropdownMenuRoot>
    </TooltipGroup>
  );
});

export type { ModelSwitchPanelProps } from './types';
