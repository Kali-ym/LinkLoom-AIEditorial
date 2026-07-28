import { useCallback } from 'react';

import { useAgentSettingStore } from '../stores/agentSettingStore';

/** §C.55*/
export function useOpenChatSettings() {
  const openAgentSetting = useAgentSettingStore((s) => s.openAgentSetting);

  return useCallback(() => {
    openAgentSetting('general');
  }, [openAgentSetting]);
}
