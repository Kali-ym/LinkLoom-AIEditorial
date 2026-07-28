import {
  Brain,
  ChartColumnBig,
  Coins,
  CreditCard,
  EthernetPort,
  Gift,
  Image as ImageIcon,
  Info,
  Keyboard,
  KeyRound,
  Map,
  Palette,
  PieChart,
  UserCircle,
  type LucideIcon,
} from 'lucide-react';

import type { MenuContext } from '../types';

export interface ContextCommand {
  icon: LucideIcon;
  keywords: string[];
  label: string;
  path: string;
  subPath: string;
}

const BUSINESS_SETTINGS_COMMANDS: ContextCommand[] = [
  {
    icon: Map,
    keywords: ['subscription', 'plan', 'upgrade', 'pricing', '套餐'],
    label: '套餐',
    path: '/settings/plans',
    subPath: 'plans',
  },
  {
    icon: Coins,
    keywords: ['credits', 'balance', 'credit', '积分'],
    label: '积分',
    path: '/settings/credits',
    subPath: 'credits',
  },
  {
    icon: PieChart,
    keywords: ['usage', 'statistics', 'consumption', '用量'],
    label: '用量',
    path: '/settings/usage',
    subPath: 'usage',
  },
  {
    icon: CreditCard,
    keywords: ['billing', 'payment', 'invoice', '账单'],
    label: '账单',
    path: '/settings/billing',
    subPath: 'billing',
  },
  {
    icon: Gift,
    keywords: ['referral', 'rewards', 'invite', '推荐'],
    label: '推荐奖励',
    path: '/settings/referral',
    subPath: 'referral',
  },
];

const CORE_SETTINGS_COMMANDS: ContextCommand[] = [
  {
    icon: UserCircle,
    keywords: ['profile', 'user', 'account', '账号'],
    label: '账号',
    path: '/settings/profile',
    subPath: 'profile',
  },
  {
    icon: Palette,
    keywords: ['common', 'appearance', 'theme', '外观'],
    label: '外观',
    path: '/settings/common',
    subPath: 'common',
  },
  {
    icon: Brain,
    keywords: ['provider', 'llm', 'model', '服务商'],
    label: 'AI 服务商',
    path: '/settings/provider',
    subPath: 'provider',
  },
  {
    icon: Keyboard,
    keywords: ['hotkey', 'shortcut', '快捷键'],
    label: '快捷键',
    path: '/settings/hotkey',
    subPath: 'hotkey',
  },
  {
    icon: ImageIcon,
    keywords: ['image', 'picture', '绘画'],
    label: '绘画服务',
    path: '/settings/image',
    subPath: 'image',
  },
  {
    icon: ChartColumnBig,
    keywords: ['stats', 'statistics', 'analytics', '统计'],
    label: '数据统计',
    path: '/settings/stats',
    subPath: 'stats',
  },
  {
    icon: KeyRound,
    keywords: ['apikey', 'api', 'key', 'token'],
    label: 'API Key',
    path: '/settings/apikey',
    subPath: 'apikey',
  },
  {
    icon: Info,
    keywords: ['about', 'version', 'info', '关于'],
    label: '关于',
    path: '/settings/about',
    subPath: 'about',
  },
];

export interface BuildContextCommandsOptions {
  enableBusinessFeatures?: boolean;
  includeDesktopProxy?: boolean;
}

export function buildSettingsCommands(options: BuildContextCommandsOptions = {}): ContextCommand[] {
  const { enableBusinessFeatures = false, includeDesktopProxy = false } = options;
  const proxyCommand: ContextCommand = {
    icon: EthernetPort,
    keywords: ['proxy', 'network', 'connection', '代理'],
    label: '网络代理',
    path: '/settings/proxy',
    subPath: 'proxy',
  };

  return [
    ...CORE_SETTINGS_COMMANDS.slice(0, 5),
    ...(includeDesktopProxy ? [proxyCommand] : []),
    ...CORE_SETTINGS_COMMANDS.slice(5),
    ...(enableBusinessFeatures ? BUSINESS_SETTINGS_COMMANDS : []),
  ];
}

/** Upstream `getContextCommands` — settings 上下文 + 全局 unpinned settings 项 */
export function getContextCommands(
  menuContext: MenuContext,
  currentSubPath: string | undefined,
  options: BuildContextCommandsOptions = {},
): ContextCommand[] {
  if (menuContext !== 'settings') return [];
  return buildSettingsCommands(options).filter((cmd) => cmd.subPath !== currentSubPath);
}

export function getGlobalSettingsCommands(
  menuContext: MenuContext,
  options: BuildContextCommandsOptions = {},
): ContextCommand[] {
  if (menuContext === 'settings') return [];
  return buildSettingsCommands(options);
}
