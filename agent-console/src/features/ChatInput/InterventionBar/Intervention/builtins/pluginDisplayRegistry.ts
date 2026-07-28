/** Admin mock display registry for InstallPlugin. */
export interface PluginDisplayInfo {
  icon: string;
  label: string;
  subtitle: string;
  type: 'Composio' | 'Skill' | 'MCP' | 'Builtin' | 'Market';
}

const REGISTRY: Record<string, PluginDisplayInfo> = {
  'composio-github': {
    icon: '🐙',
    label: 'GitHub',
    subtitle: '连接后可在对话中操作仓库与 Issue',
    type: 'Composio',
  },
  'linkloom-web-browsing': {
    icon: '🌐',
    label: 'Web Browsing',
    subtitle: '搜索与抓取网页内容',
    type: 'Builtin',
  },
};

export function resolvePluginDisplay(identifier: string, source?: string): PluginDisplayInfo {
  const known = REGISTRY[identifier];
  if (known) return known;

  return {
    icon: '🔌',
    label: identifier,
    subtitle:
      source === 'official'
        ? '点击批准后完成授权与安装'
        : '点击批准后从市场安装此插件',
    type: source === 'official' ? 'Composio' : 'Market',
  };
}
