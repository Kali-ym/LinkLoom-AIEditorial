import { Suspense, lazy, useEffect } from 'react';

import { HotkeysProvider } from './hooks/useHotkeys';
import { CmdkLazy } from './features/CommandMenu/CmdkLazy';
import { LayoutBackdrops } from './layout/LayoutBackdrops';
import { AgentConsoleShell } from './layout/AgentConsoleShell';
import { SPAGlobalProvider } from './layout/SPAGlobalProvider';
import { AGENT_CONSOLE_FONT_CSS_VARS } from './constants/typographyTokens';
import { AgentConsoleThemeProvider } from './providers/AgentConsoleThemeProvider';

import './styles/index-html.css';

const MobileTopicPanel = lazy(() =>
  import('./features/Sidebar/Topic/Mobile').then((m) => ({ default: m.MobileTopicPanel })),
);
const AgentConsoleLayout = lazy(() =>
  import('./layout/AgentConsoleLayout').then((m) => ({ default: m.AgentConsoleLayout })),
);

/**
 * Agent 主页面 — 薄组合层。
 * Editor 已下沉到 DesktopChatInputLazy，首屏不再解析 lexical。
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
        <HotkeysProvider>
          <SPAGlobalProvider>
            <div className="agent-console-editor-root">
              <CmdkLazy />
              <Suspense fallback={null}>
                <MobileTopicPanel />
              </Suspense>
              <AgentConsoleShell>
                <Suspense fallback={null}>
                  <AgentConsoleLayout />
                </Suspense>
                <LayoutBackdrops />
              </AgentConsoleShell>
            </div>
          </SPAGlobalProvider>
        </HotkeysProvider>
      </AgentConsoleThemeProvider>
    </div>
  );
}
