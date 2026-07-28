/** §C.55*/

export const HotkeyScopeEnum = {
  Chat: 'chat',
  Files: 'files',
  Global: 'global',
} as const;

export type HotkeyScopeId = (typeof HotkeyScopeEnum)[keyof typeof HotkeyScopeEnum];

export const HotkeyGroupEnum = {
  Conversation: 'conversation',
  Essential: 'essential',
} as const;

export type HotkeyGroupId = (typeof HotkeyGroupEnum)[keyof typeof HotkeyGroupEnum];

export interface HotkeyRegistryItem {
  id: string;
  keys: string;
  title: string;
  group: HotkeyGroupId;
  scopes: HotkeyScopeId[];
  /** Listed in helper; action may still be unwired */
  bound?: boolean;
  nonEditable?: boolean;
}

export const HOTKEY_REGISTRY: HotkeyRegistryItem[] = [
  {
    id: 'commandPalette',
    keys: 'mod+k',
    title: '命令面板',
    group: HotkeyGroupEnum.Essential,
    scopes: [HotkeyScopeEnum.Global],
    bound: true,
  },
  {
    id: 'search',
    keys: 'mod+j',
    title: '搜索',
    group: HotkeyGroupEnum.Essential,
    scopes: [HotkeyScopeEnum.Global],
    bound: true,
  },
  {
    id: 'switchAgent',
    keys: 'ctrl+1-9',
    title: '快捷切换助理',
    group: HotkeyGroupEnum.Essential,
    scopes: [HotkeyScopeEnum.Global],
    bound: true,
    nonEditable: true,
  },
  {
    id: 'navigateToChat',
    keys: 'ctrl+`',
    title: '切换至默认会话',
    group: HotkeyGroupEnum.Essential,
    scopes: [HotkeyScopeEnum.Global],
    bound: true,
  },
  {
    id: 'toggleLeftPanel',
    keys: 'mod+[',
    title: '显示/隐藏左侧面板',
    group: HotkeyGroupEnum.Essential,
    scopes: [HotkeyScopeEnum.Global],
    bound: true,
  },
  {
    id: 'toggleRightPanel',
    keys: 'mod+]',
    title: '显示/隐藏右侧面板',
    group: HotkeyGroupEnum.Essential,
    scopes: [HotkeyScopeEnum.Global],
    bound: true,
  },
  {
    id: 'openHotkeyHelper',
    keys: 'ctrl+shift+/',
    title: '打开快捷键帮助',
    group: HotkeyGroupEnum.Essential,
    scopes: [HotkeyScopeEnum.Global],
    bound: true,
  },
  {
    id: 'toggleZenMode',
    keys: 'mod+\\',
    title: '切换专注模式',
    group: HotkeyGroupEnum.Essential,
    scopes: [HotkeyScopeEnum.Chat],
    bound: true,
  },
  {
    id: 'openChatSettings',
    keys: 'alt+,',
    title: '打开会话设置',
    group: HotkeyGroupEnum.Conversation,
    scopes: [HotkeyScopeEnum.Chat],
    bound: true,
  },
  {
    id: 'regenerateMessage',
    keys: 'alt+r',
    title: '重新生成消息',
    group: HotkeyGroupEnum.Conversation,
    scopes: [HotkeyScopeEnum.Chat],
    bound: true,
  },
  {
    id: 'deleteLastMessage',
    keys: 'alt+d',
    title: '删除最后一条消息',
    group: HotkeyGroupEnum.Conversation,
    scopes: [HotkeyScopeEnum.Chat],
    bound: true,
  },
  {
    id: 'deleteAndRegenerateMessage',
    keys: 'alt+shift+r',
    title: '删除并重新生成',
    group: HotkeyGroupEnum.Conversation,
    scopes: [HotkeyScopeEnum.Chat],
    bound: true,
  },
  {
    id: 'saveTopic',
    keys: 'alt+n',
    title: '开启新话题',
    group: HotkeyGroupEnum.Conversation,
    scopes: [HotkeyScopeEnum.Chat],
    bound: true,
  },
  {
    id: 'addUserMessage',
    keys: 'alt+enter',
    title: '添加一条用户消息',
    group: HotkeyGroupEnum.Conversation,
    scopes: [HotkeyScopeEnum.Chat],
    bound: true,
  },
  {
    id: 'saveDocument',
    keys: 'mod+s',
    title: '保存文档',
    group: HotkeyGroupEnum.Conversation,
    scopes: [HotkeyScopeEnum.Files],
    bound: true,
  },
  {
    id: 'editMessage',
    keys: 'alt+left-double-click',
    title: '编辑消息',
    group: HotkeyGroupEnum.Conversation,
    scopes: [HotkeyScopeEnum.Chat],
    bound: false,
    nonEditable: true,
  },
];

export type HotkeyId = (typeof HOTKEY_REGISTRY)[number]['id'];

export function getHotkeyRegistryItem(id: string): HotkeyRegistryItem | undefined {
  return HOTKEY_REGISTRY.find((item) => item.id === id);
}
