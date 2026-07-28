import { memo, useEffect } from 'react';

import { fetchKbDocumentsForMention } from '../../adapters/api/mappers/inputMenu';
import { isAgentConsoleApiMode } from '../../adapters/registry';
import { mapAgentFilesToMentionFiles, mergeMentionFiles } from '../../domain/utils/mentionMenuItems';
import { buildInputMenuFromStore } from '../../services/catalog/buildInputMenuFromStore';
import { useAgentStore, useWorkspaceStore } from '../../stores';

/** api 模式：切换 Agent 时先用 store 即时刷新 @ 菜单，后台仅补 KB 文档（不打 agent-runs）。 */
export const InputMenuHydration = memo(function InputMenuHydration() {
  const activeAgentId = useAgentStore((s) => s.activeAgentId);

  useEffect(() => {
    if (!isAgentConsoleApiMode() || !activeAgentId) return;

    const fromStore = buildInputMenuFromStore(activeAgentId);
    if (fromStore) {
      useWorkspaceStore.getState().setInputMenu(fromStore);
    }

    void fetchKbDocumentsForMention()
      .then((kbFiles) => {
        if (useAgentStore.getState().activeAgentId !== activeAgentId) return;
        const menu = buildInputMenuFromStore(activeAgentId);
        if (!menu) return;
        const plusState = useAgentStore.getState().plusStateByAgentId[activeAgentId];
        const agentFiles = plusState
          ? mapAgentFilesToMentionFiles(plusState.files, { enabledOnly: true })
          : [];
        useWorkspaceStore.getState().setInputMenu({
          ...menu,
          mentionFiles: mergeMentionFiles(agentFiles, kbFiles),
        });
      })
      .catch((error) => {
        console.error('[agentConsole] refresh kb mention files failed', error);
      });
  }, [activeAgentId]);

  return null;
});
