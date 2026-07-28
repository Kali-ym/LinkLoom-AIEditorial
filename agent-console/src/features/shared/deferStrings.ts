/** api 模式未接入后端的统一空态文案 */
export const deferStrings = {
  workspaceControls: {
    title: '工作区控制',
    hint: 'Git、分支与设备切换尚未接入后端，暂不可用。',
  },
  createAgent: {
    title: '创建助手',
    hint: '创建助手尚未接入后端，请稍后在管理端配置。',
  },
  filesPanel: {
    title: '文件',
    hint: '工作区文件树尚未接入后端，暂无法浏览本地文件。',
  },
  reviewPanel: {
    title: '代码审阅',
    hint: 'Review 补丁尚未接入后端，暂无可审阅的变更。',
  },
  gitRestore: {
    title: '还原文件',
    hint: '文件还原尚未接入后端，暂不可用。',
  },
  openInSystem: {
    title: '在系统中定位',
    hint: '系统文件定位尚未接入，暂不可用。',
  },
  channelImportExport: {
    title: '导入 / 导出配置',
    hint: '频道配置导入导出尚未接入后端，暂不可用。',
  },
  messageTranslate: {
    title: '翻译',
    hint: '消息翻译尚未接入，暂不可用。',
  },
  messageTts: {
    title: '朗读',
    hint: '消息朗读尚未接入，暂不可用。',
  },
  continueGeneration: {
    title: '继续生成',
    hint: '群聊继续生成尚未接入，暂不可用。',
  },
} as const;
