/** §C.57 — zh-CN until Admin editor i18n */
export const typoBarStrings = {
  actionsOn: '显示格式工具栏',
  actionsOff: '隐藏格式工具栏',
  title: '格式工具',
  bold: '加粗',
  italic: '斜体',
  underline: '下划线',
  strikethrough: '删除线',
  bulletList: '无序列表',
  numberList: '有序列表',
  taskList: '任务列表',
  blockquote: '引用',
  tex: 'TeX 公式',
  code: '行内代码',
  codeblock: '代码块',
} as const;

export type TypoBarStringKey = keyof typeof typoBarStrings;
