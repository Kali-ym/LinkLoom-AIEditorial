import { useCallback, useMemo } from 'react';

import { useConfigStore } from '../../../../stores/configStore';
import { useModelPanelStore } from '../../../../stores/modelPanelStore';
import {
  DEFAULT_WIDTH,
  DEV_DEFAULT_WIDTH,
  FOOTER_HEIGHT,
  ITEM_HEIGHT,
  MAX_PANEL_HEIGHT,
  TOOLBAR_HEIGHT,
} from '../const';

export function usePanelSize(enabledListLength: number) {
  const isDevMode = useConfigStore((s) => s.isDevMode);
  const panelWidth = useModelPanelStore((s) => s.panelWidth);
  const setPanelWidth = useModelPanelStore((s) => s.setPanelWidth);

  const effectiveWidth = isDevMode ? panelWidth || DEV_DEFAULT_WIDTH : DEFAULT_WIDTH;

  const panelHeight = useMemo(
    () =>
      enabledListLength === 0
        ? TOOLBAR_HEIGHT + ITEM_HEIGHT['no-provider'] + FOOTER_HEIGHT
        : MAX_PANEL_HEIGHT,
    [enabledListLength],
  );

  const handlePanelWidthChange = useCallback(
    (width: number) => {
      setPanelWidth(width);
    },
    [setPanelWidth],
  );

  return { handlePanelWidthChange, panelHeight, panelWidth: effectiveWidth };
}
