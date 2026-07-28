import type { LucideIcon } from 'lucide-react';
import {
  Bot,
  CalendarClock,
  ClipboardList,
  FilePen,
  FilePlus2,
  FileSearch,
  FileText,
  FolderInput,
  FolderOpen,
  Gauge,
  Hand,
  HelpCircle,
  ListTodo,
  Package,
  Play,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Terminal,
  Trash2,
  Users,
} from 'lucide-react';

import { getToolDisplayName } from '../../Messages/AssistantGroup/toolDisplayNames';

export type InterventionRisk = 'low' | 'medium' | 'high';

export interface InterventionMeta {
  icon: LucideIcon;
  label: string;
  subtitle: string;
  risk: InterventionRisk;
}

const API_META: Record<string, Omit<InterventionMeta, 'label'>> = {
  runCommand: {
    icon: Terminal,
    subtitle: '将在工作区执行 Shell 命令',
    risk: 'high',
  },
  executeCode: {
    icon: Play,
    subtitle: '将在云沙箱中运行代码',
    risk: 'high',
  },
  writeFile: {
    icon: FilePlus2,
    subtitle: '将创建或覆盖本地文件',
    risk: 'medium',
  },
  editFile: {
    icon: FilePen,
    subtitle: '将修改现有文件内容',
    risk: 'medium',
  },
  moveFiles: {
    icon: FolderInput,
    subtitle: '将移动或重命名文件',
    risk: 'medium',
  },
  createPlan: {
    icon: ClipboardList,
    subtitle: '将写入新的执行计划',
    risk: 'low',
  },
  createTodos: {
    icon: ListTodo,
    subtitle: '将添加待办任务列表',
    risk: 'low',
  },
  clearTodos: {
    icon: Trash2,
    subtitle: '将清空当前待办',
    risk: 'low',
  },
  askUserQuestion: {
    icon: HelpCircle,
    subtitle: '需要你补充信息后才能继续',
    risk: 'low',
  },
  pickAgents: {
    icon: Users,
    subtitle: '将选择参与协作的 Agent',
    risk: 'low',
  },
  installPlugin: {
    icon: Package,
    subtitle: '将安装或启用插件',
    risk: 'medium',
  },
  activateTools: {
    icon: Bot,
    subtitle: '将启用额外工具能力',
    risk: 'medium',
  },
  readFile: {
    icon: FileText,
    subtitle: '将读取本地文件内容',
    risk: 'low',
  },
  listFiles: {
    icon: FolderOpen,
    subtitle: '将列出目录中的文件',
    risk: 'low',
  },
  globFiles: {
    icon: FileSearch,
    subtitle: '将按模式匹配文件路径',
    risk: 'low',
  },
  grepContent: {
    icon: Search,
    subtitle: '将在文件中搜索匹配内容',
    risk: 'low',
  },
  searchFiles: {
    icon: Search,
    subtitle: '将按关键词搜索文件',
    risk: 'low',
  },
  renameFile: {
    icon: FilePen,
    subtitle: '将重命名文件或目录',
    risk: 'medium',
  },
  executeTask: {
    icon: Users,
    subtitle: '将委派任务给其他 Agent',
    risk: 'medium',
  },
  executeTasks: {
    icon: Users,
    subtitle: '将批量委派多个 Agent 任务',
    risk: 'medium',
  },
  addExperienceMemory: {
    icon: ClipboardList,
    subtitle: '将保存一条经验记忆',
    risk: 'low',
  },
  saveUserQuestion: {
    icon: HelpCircle,
    subtitle: '将保存你的 onboarding 回答',
    risk: 'low',
  },
  createCron: {
    icon: CalendarClock,
    subtitle: '将创建或更新定时任务',
    risk: 'medium',
  },
  updateCron: {
    icon: CalendarClock,
    subtitle: '将修改现有定时任务',
    risk: 'medium',
  },
  deleteCron: {
    icon: ShieldAlert,
    subtitle: '将永久删除定时任务',
    risk: 'high',
  },
  runScheduleNow: {
    icon: Play,
    subtitle: '将立即执行一次定时任务',
    risk: 'medium',
  },
  runWorkflow: {
    icon: Play,
    subtitle: '将启动工作流运行',
    risk: 'medium',
  },
  triggerScoring: {
    icon: Gauge,
    subtitle: '将触发新闻评分管线',
    risk: 'medium',
  },
  decideWorkflowStep: {
    icon: ClipboardList,
    subtitle: '将审批或拒绝工作流步骤',
    risk: 'medium',
  },
  updateNewsScore: {
    icon: Gauge,
    subtitle: '将修改新闻评分',
    risk: 'medium',
  },
  deleteNews: {
    icon: Trash2,
    subtitle: '将删除新闻条目',
    risk: 'high',
  },
  generateDailyReport: {
    icon: FileText,
    subtitle: '将生成日报内容',
    risk: 'medium',
  },
  publishReport: {
    icon: Send,
    subtitle: '将向渠道发布日报',
    risk: 'high',
  },
  syncAdapter: {
    icon: RefreshCw,
    subtitle: '将触发采集适配器同步',
    risk: 'medium',
  },
  clearAdapterData: {
    icon: ShieldAlert,
    subtitle: '将清理适配器已抓取数据（不可撤销）',
    risk: 'high',
  },
  refreshDigestContext: {
    icon: RefreshCw,
    subtitle: '将触发 digest 管线定时任务，刷新摘要上下文',
    risk: 'medium',
  },
  republishReport: {
    icon: Send,
    subtitle: '将根据历史记录重新发布到原渠道',
    risk: 'medium',
  },
  deleteCommitHistory: {
    icon: ShieldAlert,
    subtitle: '将永久删除发布历史存档（不可撤销）',
    risk: 'high',
  },
  saveAgent: {
    icon: Bot,
    subtitle: '将保存或更新智能体配置',
    risk: 'medium',
  },
  deleteAgent: {
    icon: ShieldAlert,
    subtitle: '将永久删除智能体（不可撤销）',
    risk: 'high',
  },
  saveWorkflow: {
    icon: Bot,
    subtitle: '将保存或更新工作流定义',
    risk: 'medium',
  },
  instantiateTemplate: {
    icon: Bot,
    subtitle: '将从模板实例化智能体与工作流',
    risk: 'medium',
  },
  updateSettings: {
    icon: ShieldAlert,
    subtitle: '将修改系统设置（不可轻易撤销）',
    risk: 'high',
  },
  testAiProvider: {
    icon: Gauge,
    subtitle: '将测试 AI 提供商连接',
    risk: 'medium',
  },
  createApiKey: {
    icon: ShieldAlert,
    subtitle: '将创建新的平台 API Key',
    risk: 'medium',
  },
  createKbCategory: {
    icon: FileText,
    subtitle: '将创建知识库分类',
    risk: 'medium',
  },
  deleteKbDocument: {
    icon: Trash2,
    subtitle: '将永久删除知识库文档（不可撤销）',
    risk: 'high',
  },
  batchResetScoring: {
    icon: Gauge,
    subtitle: '将批量重置新闻评分',
    risk: 'medium',
  },
  backfillPublicationItems: {
    icon: RefreshCw,
    subtitle: '将回填发布条目数据',
    risk: 'medium',
  },
};

/** Legacy / Local apiName aliases → canonical keys in API_META. */
const API_META_ALIASES: Record<string, string> = {
  showAgentMarketplace: 'pickAgents',
  executeAgentTask: 'executeTask',
  executeAgentTasks: 'executeTasks',
  editLocalFile: 'editFile',
  writeLocalFile: 'writeFile',
  moveLocalFiles: 'moveFiles',
  readLocalFile: 'readFile',
  listLocalFiles: 'listFiles',
  globLocalFiles: 'globFiles',
  searchLocalFiles: 'searchFiles',
  renameLocalFile: 'renameFile',
};

function resolveInterventionApiName(apiName: string): string {
  return API_META_ALIASES[apiName] ?? apiName;
}

export function hasInterventionMeta(apiName: string): boolean {
  return Boolean(API_META[resolveInterventionApiName(apiName)]);
}

const DEFAULT_META: Omit<InterventionMeta, 'label'> = {
  icon: Hand,
  subtitle: '代理暂停执行，等待你确认后继续',
  risk: 'medium',
};

export function getInterventionMeta(apiName: string, identifier?: string): InterventionMeta {
  const canonical = resolveInterventionApiName(apiName);
  const base = API_META[canonical] ?? DEFAULT_META;
  const label = getToolDisplayName(apiName);
  const subtitle =
    canonical === 'activateTools' && identifier
      ? `将启用 ${identifier} 相关能力`
      : base.subtitle;

  return { ...base, label, subtitle };
}

export const RISK_LABEL: Record<InterventionRisk, string> = {
  low: '低风险',
  medium: '需确认',
  high: '敏感操作',
};
