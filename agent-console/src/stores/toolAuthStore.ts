import { create } from 'zustand';

import type { PendingAuthTool } from '../domain/types/toolAuth';
import { getAgentConsolePorts, isAgentConsoleApiMode } from '../adapters/registry';
import { showToast } from '../services/ui/toast';
import { useAgentStore } from './agentStore';

interface ToolAuthState {
  pendingTools: PendingAuthTool[];

  hydrate: (tools: PendingAuthTool[]) => void;
  authorizeTool: (toolId: string) => void | Promise<void>;
  refreshPendingTools: () => Promise<void>;
}

const pollTimers = new Map<string, number>();

export const useToolAuthStore = create<ToolAuthState>((set, get) => ({
  pendingTools: [],

  hydrate: (tools) => set({ pendingTools: tools }),

  refreshPendingTools: async () => {
    if (!isAgentConsoleApiMode()) return;
    try {
      const agentId = useAgentStore.getState().activeAgentId;
      const tools = await getAgentConsolePorts().runtime.getPendingAuthTools(agentId);
      set({ pendingTools: tools });
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('[toolAuthStore] refresh pending tools failed', error);
      }
    }
  },

  authorizeTool: async (toolId) => {
    const tool = get().pendingTools.find((t) => t.id === toolId);
    if (!tool) return;

    if (!isAgentConsoleApiMode()) {
      if (tool.authType === 'market') {
        showToast(`正在打开 ${tool.label} 登录…`);
      } else {
        showToast(`正在打开 ${tool.label} 授权窗口（600×700）…`);
      }
      set((s) => ({
        pendingTools: s.pendingTools.filter((t) => t.id !== toolId),
      }));
      return;
    }

    const agentId = useAgentStore.getState().activeAgentId;
    try {
      const ports = getAgentConsolePorts();
      const { authUrl } = await ports.runtime.authorizePendingTool(agentId, toolId);
      window.open(
        ports.runtime.resolveToolAuthPopupUrl(authUrl),
        'tool-auth',
        'width=600,height=700,noopener,noreferrer',
      );

      const existingTimer = pollTimers.get(toolId);
      if (existingTimer) window.clearInterval(existingTimer);

      const timer = window.setInterval(() => {
        void get()
          .refreshPendingTools()
          .then(() => {
            const stillPending = get().pendingTools.some((item) => item.id === toolId);
            if (!stillPending) {
              window.clearInterval(timer);
              pollTimers.delete(toolId);
              showToast(`${tool.label} 授权完成`);
            }
          });
      }, 1500);
      pollTimers.set(toolId, timer);

      window.setTimeout(() => {
        window.clearInterval(timer);
        pollTimers.delete(toolId);
      }, 120_000);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
            ? error.message
            : '授权失败';
      showToast(message);
    }
  },
}));
