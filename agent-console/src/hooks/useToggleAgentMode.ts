import { useCallback } from 'react';

import { useAgentStore } from '../stores';

/** Upstream `useToggleAgentMode` — toggles `chatConfig.enableAgentMode`. */
export function useToggleAgentMode() {
  const updateAgentChatConfig = useAgentStore((s) => s.updateAgentChatConfig);

  return useCallback(
    async (enableAgentMode: boolean) => {
      updateAgentChatConfig({ enableAgentMode });
    },
    [updateAgentChatConfig],
  );
}
