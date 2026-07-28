import { useCallback } from 'react';

import { useModelPanelStore } from '../../../../stores/modelPanelStore';
import type { GroupMode } from '../types';

export function usePanelState() {
  const groupMode = useModelPanelStore((s) => s.groupMode);
  const setGroupMode = useModelPanelStore((s) => s.setGroupMode);

  const handleGroupModeChange = useCallback(
    (mode: GroupMode) => {
      setGroupMode(mode);
    },
    [setGroupMode],
  );

  return { groupMode, handleGroupModeChange };
}
