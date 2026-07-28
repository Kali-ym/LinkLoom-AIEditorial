import { ConfigProvider, ThemeProvider } from '@lobehub/ui';
import { m } from 'framer-motion';

import { useTheme } from '../context/ThemeContext';
import { CONSOLE_FONT_FAMILY, CONSOLE_FONT_FAMILY_CODE } from '../constants/typographyTokens';

interface AgentConsoleThemeProviderProps {
  children: React.ReactNode;
}

/** Agent Console theme root — appearance follows Admin ThemeContext. */
export function AgentConsoleThemeProvider({ children }: AgentConsoleThemeProviderProps) {
  const { theme } = useTheme();
  const appearance = theme === 'dark' ? 'dark' : 'light';

  return (
    <ThemeProvider
      appearance={appearance}
      defaultAppearance={appearance}
      defaultThemeMode={appearance}
      theme={{
        cssVar: { key: 'console-vars' },
        token: {
          fontFamily: CONSOLE_FONT_FAMILY,
          fontFamilyCode: CONSOLE_FONT_FAMILY_CODE,
          borderRadius: 10,
          borderRadiusLG: 12,
          borderRadiusSM: 8,
          motionDurationFast: '0.15s',
          motionDurationMid: '0.25s',
        },
      }}
    >
      {/* `m` works with LazyMotion/domAnimation — avoid full `motion` import. */}
      <ConfigProvider motion={m}>
        <div className="agent-console-provider-root">{children}</div>
      </ConfigProvider>
    </ThemeProvider>
  );
}
