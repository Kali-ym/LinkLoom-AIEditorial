/**
 * Agent Console typography — single source of truth for @lobehub/ui ThemeProvider.
 * Prototype CSS vars (--font-body / --font-mono) are injected from AgentConsolePage on mount.
 */
export const CONSOLE_FONT_FAMILY =
  "'Inter', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

export const CONSOLE_FONT_FAMILY_CODE =
  "'JetBrains Mono', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";

/** CSS custom properties for legacy prototype classes in index-html.css */
export const AGENT_CONSOLE_FONT_CSS_VARS = {
  '--font-body': CONSOLE_FONT_FAMILY,
  '--font-display': CONSOLE_FONT_FAMILY,
  '--font-mono': CONSOLE_FONT_FAMILY_CODE,
} as const;
