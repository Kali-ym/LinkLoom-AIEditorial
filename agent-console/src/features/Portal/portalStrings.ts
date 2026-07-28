/** §C.21 / §C.56 Portal 文案 */
import { t } from '../../i18n';

export const portalStrings = {
  modalTitle: t('portal.title'),
  home: {
    title: '工作区',
    files: '文件',
    artifacts: '产物',
    emptyFiles: '暂无知识库文件',
    emptyArtifacts: '暂无产物',
  },
  notebook: {
    title: '笔记本',
    empty: '暂无笔记本文档',
    deleteTitle: '删除文档',
    deleteContent: (title: string) => `确定删除「${title}」？`,
    deleteOk: '删除',
  },
  messageDetail: {
    title: '消息详情',
    empty: '（无内容）',
  },
  thread: {
    defaultTitle: '分支对话',
    subagentReadonly: 'Subagent 模式 — 只读，无输入框',
    switchMain: '切换主会话',
    close: '关闭',
    continuation: 'Continuation',
    standalone: 'Standalone',
  },
  groupThread: {
    empty: '暂无 DM 消息',
    placeholder: '选择左侧成员开始对话',
  },
  filePreview: {
    chunk: 'Chunk',
    file: 'File',
    loading: '加载文件…',
  },
  localFile: {
    render: '渲染',
    raw: '原始',
    source: '源码',
    error: '无法打开本地文件',
  },
  verify: {
    confidence: '置信度',
    verifier: '验证器',
    instruction: '指令',
    assertion: '断言',
    trace: '查看轨迹',
    pending: '验证进行中…',
  },
  common: {
    back: '返回',
    close: '关闭',
    preview: '预览',
    code: '代码',
  },
} as const;
