import { EditorProvider } from '@lobehub/editor/react';
import { useEffect } from 'react';

import { HotkeysProvider } from './hooks/useHotkeys';
import { CmdkLazy } from './features/CommandMenu/CmdkLazy';
import { MobileTopicPanel } from './features/Sidebar/Topic/Mobile';
import { AgentConsoleLayout } from './layout/AgentConsoleLayout';
import { LayoutBackdrops } from './layout/LayoutBackdrops';
import { AgentConsoleShell } from './layout/AgentConsoleShell';
import { SPAGlobalProvider } from './layout/SPAGlobalProvider';
import { AGENT_CONSOLE_FONT_CSS_VARS } from './constants/typographyTokens';
import { AgentConsoleThemeProvider } from './providers/AgentConsoleThemeProvider';

import './styles/index-html.css';

/**
 * Agent 主页面 — 薄组合层（对齐 sandbox agent/index.tsx）
 * ChatHydration + Conversation 布局 + TelemetryNotification
 */
export default function AgentConsolePage() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('agent-console-active');
    document.body.classList.add('agent-console-active');
    for (const [name, value] of Object.entries(AGENT_CONSOLE_FONT_CSS_VARS)) {
      root.style.setProperty(name, value);
    }
    return () => {
      root.classList.remove('agent-console-active');
      document.body.classList.remove('agent-console-active');
      for (const name of Object.keys(AGENT_CONSOLE_FONT_CSS_VARS)) {
        root.style.removeProperty(name);
      }
    };
  }, []);

  return (
    <div className="agent-console-host">
      <AgentConsoleThemeProvider>
        <EditorProvider>
          <HotkeysProvider>
            <SPAGlobalProvider>
              <div className="agent-console-editor-root">
                <CmdkLazy />
                <MobileTopicPanel />
                <AgentConsoleShell>
                  <AgentConsoleLayout />
                  <LayoutBackdrops />
                </AgentConsoleShell>
              </div>
            </SPAGlobalProvider>
          </HotkeysProvider>
        </EditorProvider>
      </AgentConsoleThemeProvider>
    </div>
  );
}
