import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { devLogger } from '../../utils/devLogger';
import { agentService } from '../../services/agentService';
import { knowledgeService } from '../../services/knowledgeService';
import type { KBCategory } from '../../services/knowledgeService';
import type {
  Agent,
  AgentWorkflowReference,
  AiBuilderMention,
  Skill,
  SkillScanResult,
  Tool,
  Workflow,
  WorkflowStep,
  MCPServerConfig,
  WorkflowTemplateSummary
} from '../../services/agentService';
import { getWorkflowStepLabel } from '../../utils/workflowStepLabel';
import { getSettings } from '../../services/settingsService';
import { useToast } from '../../context/ToastContext.js';
import { useMessageDialog } from '../../context/MessageDialogContext';
import { copyToClipboard } from '../../utils/clipboardUtils';
import { genericImport } from '../../services/importService';
import { getTodayShanghai } from '../../utils/dateUtils';
import { getEntityIdFormatError, isResourceIdTaken } from '../../utils/entityId';
import { getNextStepIds } from '../../utils/workflowGraph';
import { normalizeWorkflowStepInputTemplate } from '../../utils/workflowFieldRefs';
import CategoryPickerModal from '../../components/UI/CategoryPickerModal';
import AgentsPageShell from './AgentsPageShell';
import { createStepFromCatalog } from './workflow/pipelineStepDefaults';
import { useStepCatalog } from '../../hooks/useStepCatalog';
import {
  applyTemplateVariableValues,
  extractTemplateVariableValues,
  parseTemplateIdFromWorkflow
} from './workflow/workflowTemplateVariables';
import { AiBuilderPanel } from './aiBuilder/AiBuilderPanel';
import { AgentsTab } from './tabs/AgentsTab';
import { SkillsTab } from './tabs/SkillsTab';
import { ToolsTab } from './tabs/ToolsTab';
import { WorkflowsTab } from './tabs/WorkflowsTab';
import { ToolExecutionModal } from './ToolExecutionModal';
import {
  AGENT_TOOL_CATEGORY_CONFIG,
  agentToolNeedsCategoryPicker,
  clearAgentCategoryBinding,
  getAgentCategoryBindingIds,
  setAgentCategoryBindingIds
} from '../../utils/agentToolBindings';
import { filterPublicCatalogTools } from '../../domain/consoleCatalog';

const DAG_NODE_BG: Record<string, string> = {
  emerald:
    'bg-teal-light dark:bg-teal-light/10 text-moss-dark dark:text-teal-300 border-teal-light dark:border-teal-500/20',
  sky: 'bg-sky-50/90 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-200/60 dark:border-sky-500/20',
  amber:
    'bg-amber-50/90 dark:bg-amber-500/10 text-amber-800 dark:text-amber-200 border-amber-200/60 dark:border-amber-500/20',
  violet:
    'bg-surface-lavender dark:bg-purple-500/10 text-ink-deep dark:text-violet-300 border-hairline dark:border-violet-500/20',
  rose: 'bg-rose-50/90 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200/60 dark:border-rose-500/20',
  slate:
    'bg-surface-soft dark:bg-canvas/[0.03] text-text-slate dark:text-text-secondary border-hairline-soft dark:border-white/10'
};
const DAG_ICON_BG: Record<string, string> = {
  emerald: 'bg-teal-light text-moss-dark',
  sky: 'bg-sky-500/20 text-sky-500',
  amber: 'bg-amber-500/20 text-amber-600',
  violet: 'bg-surface-lavender text-ink-deep',
  rose: 'bg-rose-500/20 text-rose-500',
  slate: 'bg-surface text-text-slate'
};

const Agents: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { success: toastSuccess, error: toastError } = useToast();
  const { alert: showAlert, confirm: showConfirm } = useMessageDialog();
  const stepCatalog = useStepCatalog();
  const [activeTab, setActiveTab] = useState('agents');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [workflowTemplates, setWorkflowTemplates] = useState<WorkflowTemplateSummary[]>([]);
  const [settings, setSettings] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [mcpConfigs, setMcpConfigs] = useState<MCPServerConfig[]>([]);
  const [editingMCP, setEditingMCP] = useState<MCPServerConfig | null>(null);
  const [testResults, setTestResults] = useState<Record<string, string>>({});
  const [testingAgentId, setTestingAgentId] = useState<string | null>(null);
  const [testInput, setTestInput] = useState('');
  const [testDate, setTestDate] = useState(getTodayShanghai());
  const [isUploading, setIsUploading] = useState(false);
  const [isScanningSkills, setIsScanningSkills] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const skillFileRef = React.useRef<HTMLInputElement>(null);
  const [previewSkill, setPreviewSkill] = useState<Skill | null>(null);
  const [skillFileTree, setSkillFileTree] = useState<any[]>([]);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [selectedFileContent, setSelectedFileContent] = useState<string | null>(null);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [showWorkflowTemplates, setShowWorkflowTemplates] = useState(false);
  const [selectedWorkflowTemplateId, setSelectedWorkflowTemplateId] = useState<string | null>(null);
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});
  const [editingWorkflowTemplateVars, setEditingWorkflowTemplateVars] = useState<Record<
    string,
    string
  > | null>(null);
  const [isInstantiatingTemplate, setIsInstantiatingTemplate] = useState(false);
  const [testingWorkflowId, setTestingWorkflowId] = useState<string | null>(null);
  const [workflowTestInput, setWorkflowTestInput] = useState('');
  const [workflowTestResult, setWorkflowTestResult] = useState<Record<string, string>>({});

  const [executingTool, setExecutingTool] = useState<Tool | null>(null);
  const [toolArguments, setToolArguments] = useState<Record<string, any>>({});
  const [toolExecutionResult, setToolExecutionResult] = useState<any>(null);
  const [isExecutingTool, setIsExecutingTool] = useState(false);

  const [foldedGroups, setFoldedGroups] = useState<Record<string, boolean>>({});
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [stepPickerOpen, setStepPickerOpen] = useState(false);
  const [kbCategories, setKbCategories] = useState<KBCategory[]>([]);
  const [memoryCategories, setMemoryCategories] = useState<KBCategory[]>([]);
  const [categoryPicker, setCategoryPicker] = useState<{
    toolId: string;
    mode: 'enable' | 'edit';
  } | null>(null);
  const [aiBuilderOpen, setAiBuilderOpen] = useState(false);
  const [aiBuilderInitialMention, setAiBuilderInitialMention] = useState<AiBuilderMention | null>(
    null
  );
  const [aiBuilderBackgroundActive, setAiBuilderBackgroundActive] = useState(false);
  /** 打开编辑弹窗时的资源 ID；新建时为 null，用于唯一性校验与改名后删旧记录 */
  const agentOriginalIdRef = React.useRef<string | null>(null);
  const mcpOriginalIdRef = React.useRef<string | null>(null);
  const workflowOriginalIdRef = React.useRef<string | null>(null);

  // Handle deep-link: auto-open agent/workflow editor from URL params
  useEffect(() => {
    const editId = searchParams.get('edit');
    const newType = searchParams.get('new');

    if (editId) {
      const decoded = decodeURIComponent(editId);
      const tab = searchParams.get('tab');
      if (tab === 'workflows') {
        const wf = workflows.find(w => w.id === decoded);
        if (wf) {
          setActiveTab('workflows');
          setEditingWorkflow(wf);
        }
      } else {
        const ag = agents.find(a => a.id === decoded);
        if (ag) {
          setActiveTab('agents');
          setEditingAgent(ag);
        }
      }
    } else if (newType === 'agent') {
      setActiveTab('agents');
      agentOriginalIdRef.current = null;
      const defaultProviderId = settings.ACTIVE_AI_PROVIDER_ID || settings.AI_PROVIDERS?.[0]?.id || '';
      const defaultProvider = (settings.AI_PROVIDERS || []).find((p: any) => p.id === defaultProviderId);
      setEditingAgent({
        id: `agent_${Math.random().toString(36).substr(2, 5)}`,
        name: '新 Agent',
        description: '',
        systemPrompt: '',
        providerId: defaultProviderId,
        model: defaultProvider?.models?.[0] || '',
        temperature: 1.0,
        toolIds: [],
        skillIds: [],
        mcpServerIds: [],
        runtime: { mode: 'classic', maxRounds: 5, returnTrace: true, toolErrorStrategy: 'observe-and-continue', maxRepeatedToolErrors: 2, stopOnRepeatedToolError: true },
        knowledgeCategoryIds: [],
        knowledgeSaveCategoryIds: [],
        memoryCategoryIds: [],
        memorySaveCategoryIds: []
      });
    } else if (newType === 'workflow') {
      setActiveTab('workflows');
      workflowOriginalIdRef.current = null;
      setEditingWorkflow({
        id: `workflow_${Math.random().toString(36).substr(2, 5)}`,
        name: '新工作流',
        description: '',
        steps: [],
        initialStepId: '',
      });
    }

    // Clean up URL params after handling
    if (editId || newType) {
      navigate('/agents', { replace: true });
    }
  }, [searchParams, agents, workflows, settings]);

  const handleCopy = async (text: string) => {
    if (!text) return;
    const success = await copyToClipboard(text);
    if (success) {
      toastSuccess('复制成功');
    } else {
      toastError('复制失败');
    }
  };

  const openAiBuilder = (mention?: AiBuilderMention) => {
    setAiBuilderInitialMention(mention || null);
    setAiBuilderOpen(true);
  };

  const getToolDisplayName = (tool: Tool) =>
    tool.displayName?.trim() || tool.name?.trim() || tool.id;

  const getCategoriesForTool = (toolId: string) => {
    const cfg = AGENT_TOOL_CATEGORY_CONFIG[toolId];
    if (!cfg) return [];
    return cfg.categoryType === 'knowledge' ? kbCategories : memoryCategories;
  };

  const formatBindingSummary = (toolId: string, agent: Agent) => {
    const ids = getAgentCategoryBindingIds(agent, toolId);
    if (ids.length === 0) return '';
    const cats = getCategoriesForTool(toolId);
    const names = ids.map((id) => cats.find((c) => c.id === id)?.name).filter(Boolean) as string[];
    if (names.length <= 2) return names.join('、');
    return `${names.slice(0, 2).join('、')} 等 ${ids.length} 项`;
  };

  const openCategoryPicker = (toolId: string, mode: 'enable' | 'edit') => {
    setCategoryPicker({ toolId, mode });
  };

  const handleAgentToolClick = (tool: Tool) => {
    if (!editingAgent) return;
    const toolIds = editingAgent.toolIds || [];
    const enabled = toolIds.includes(tool.id);

    if (agentToolNeedsCategoryPicker(tool.id)) {
      if (enabled) {
        openCategoryPicker(tool.id, 'edit');
        return;
      }
      const cats = getCategoriesForTool(tool.id);
      if (cats.length === 0) {
        toastError('请先在「知识与记忆」中创建分类');
        return;
      }
      openCategoryPicker(tool.id, 'enable');
      return;
    }

    const ids = enabled ? toolIds.filter((id) => id !== tool.id) : [...toolIds, tool.id];
    setEditingAgent({ ...editingAgent, toolIds: ids });
  };

  const handleAgentToolDisable = (tool: Tool, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editingAgent) return;
    let next: Agent = {
      ...editingAgent,
      toolIds: (editingAgent.toolIds || []).filter((id) => id !== tool.id)
    };
    if (agentToolNeedsCategoryPicker(tool.id)) {
      next = clearAgentCategoryBinding(next, tool.id);
    }
    setEditingAgent(next);
  };

  const handleCategoryPickerConfirm = (ids: string[]) => {
    if (!editingAgent || !categoryPicker) return;
    const { toolId, mode } = categoryPicker;
    let next = setAgentCategoryBindingIds(editingAgent, toolId, ids);
    if (mode === 'enable' && !(next.toolIds || []).includes(toolId)) {
      next = { ...next, toolIds: [...(next.toolIds || []), toolId] };
    }
    setEditingAgent(next);
    setCategoryPicker(null);
  };
  const agentTools = filterPublicCatalogTools(
    tools.filter((tool) => !tool.scope || tool.scope === 'agent' || tool.scope === 'both'),
  );
  const visibleToolCatalog = filterPublicCatalogTools(
    tools.filter((tool) => tool.scope !== 'system'),
  );
  const aiProviders = Array.isArray(settings.AI_PROVIDERS) ? settings.AI_PROVIDERS : [];

  const openWorkflowEditor = (workflow: Workflow, originalId: string | null = workflow.id) => {
    workflowOriginalIdRef.current = originalId;
    const templateId = parseTemplateIdFromWorkflow(workflow);
    const template = workflowTemplates.find((item) => item.id === templateId);
    setEditingWorkflow(workflow);
    setEditingWorkflowTemplateVars(
      template?.variables?.length
        ? extractTemplateVariableValues(workflow, template.variables, agents)
        : null
    );
  };

  const closeWorkflowEditor = () => {
    setEditingWorkflow(null);
    setEditingWorkflowTemplateVars(null);
  };

  const patchEditingWorkflowTemplateVar = (id: string, value: string) => {
    setEditingWorkflowTemplateVars((prev) => (prev ? { ...prev, [id]: value } : prev));
    if (!editingWorkflow) return;
    if (id === 'reportName') setEditingWorkflow({ ...editingWorkflow, name: value });
    if (id === 'workflowId') setEditingWorkflow({ ...editingWorkflow, id: value });
    if (id === 'descriptionDefault') setEditingWorkflow({ ...editingWorkflow, description: value });
  };

  const editingWorkflowTemplate = editingWorkflow
    ? workflowTemplates.find((item) => item.id === parseTemplateIdFromWorkflow(editingWorkflow))
    : undefined;

  const handleImportAsDataSource = async (content: string, titlePrefix: string) => {
    if (!content) return;

    const confirmed = await showConfirm({
      title: '导入为数据源',
      message: '确定将此结果导入为数据源吗？'
    });
    if (!confirmed) return;

    try {
      // 1. 获取默认分类
      const defaultCategory = settings.CATEGORIES?.[0]?.id || 'rss';

      // 2. 执行导入（统一按 TEXT 导入）
      await genericImport('TEXT', defaultCategory, {
        title: `${titlePrefix} - ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`,
        content
      });

      toastSuccess('导入成功，请在“内容筛选”页面查看');
    } catch (error: any) {
      toastError('导入失败: ' + error.message);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [
        agentsData,
        skillsData,
        toolsData,
        workflowsData,
        templatesData,
        settingsData,
        mcpData,
        kbCats,
        memCats
      ] = await Promise.all([
        agentService.getAgents(),
        agentService.getSkills(),
        agentService.getTools(),
        agentService.getWorkflows(),
        agentService.getWorkflowTemplates().catch(() => []),
        getSettings(),
        agentService.getMCPConfigs(),
        knowledgeService.getCategories().catch(() => []),
        knowledgeService.getMemoryCategories().catch(() => [])
      ]);
      setAgents(agentsData);
      setSkills(skillsData);
      setTools(toolsData);
      setWorkflows(workflowsData);
      setWorkflowTemplates(templatesData);
      setSettings(settingsData);
      setMcpConfigs(mcpData);
      setKbCategories(kbCats);
      setMemoryCategories(memCats);
    } catch (error) {
      devLogger.error('Failed to load agent data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAgent = async (agent: Agent) => {
    const trimmedId = agent.id.trim();
    const fmtErr = getEntityIdFormatError(trimmedId);
    if (fmtErr) {
      toastError(fmtErr);
      return;
    }
    const orig = agentOriginalIdRef.current;
    if (isResourceIdTaken(agents, trimmedId, orig)) {
      toastError('该 ID 已被其他智能体使用');
      return;
    }
    const toSave = { ...agent, id: trimmedId };
    if (orig && orig !== trimmedId) {
      let refHint = '';
      try {
        const refs = await agentService.getAgentWorkflowReferences(orig);
        if (refs.length > 0) {
          refHint = `\n\n以下工作流仍引用旧 ID：${refs.map((wf: AgentWorkflowReference) => `${wf.name}（${wf.id}）`).join('、')}`;
        }
      } catch {
        /* 引用查询失败时不阻断保存，后端删除旧 ID 时仍会校验 */
      }
      const ok = await showConfirm({
        title: '修改智能体 ID',
        message: `修改智能体 ID 将保存为新 ID 并删除旧记录；引用旧 ID 的工作流需同步改为新 ID。${refHint}\n\n是否继续？`,
        confirmLabel: '继续保存'
      });
      if (!ok) return;
    }
    try {
      setIsSaving(true);
      await agentService.saveAgent(toSave);
      if (orig && orig !== trimmedId) {
        await agentService.deleteAgent(orig);
      }
      await loadData();
      setEditingAgent(null);
      toastSuccess('Agent 保存成功');
    } catch (error) {
      toastError(error instanceof Error ? error.message : '保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAgent = async (agent: Agent) => {
    try {
      const refs = await agentService.getAgentWorkflowReferences(agent.id);
      if (refs.length > 0) {
        const lines = refs
          .map((wf: AgentWorkflowReference) => `· ${wf.name}（${wf.id}）`)
          .join('\n');
        await showAlert({
          title: '无法删除',
          message: `智能体「${agent.name}」仍被以下工作流引用，请先从工作流中移除或更换该步骤的智能体后再删：\n\n${lines}`,
          variant: 'warning'
        });
        return;
      }
      if (
        !(await showConfirm({
          title: '删除智能体',
          message: `确定删除智能体「${agent.name}」吗？`,
          confirmLabel: '删除',
          variant: 'danger',
          confirmTone: 'danger'
        }))
      )
        return;
      await agentService.deleteAgent(agent.id);
      await loadData();
      toastSuccess('Agent 已删除');
    } catch (error) {
      toastError(error instanceof Error ? error.message : '删除失败');
    }
  };

  const handleExecuteTool = async () => {
    if (!executingTool) return;
    try {
      setIsExecutingTool(true);
      setToolExecutionResult(null);
      const result = await agentService.runTool(executingTool.id, toolArguments);
      setToolExecutionResult(result);
    } catch (error: any) {
      setToolExecutionResult({ success: false, error: error.message });
    } finally {
      setIsExecutingTool(false);
    }
  };

  const handleRunAgent = async (id: string, input: string) => {
    try {
      const agent = agents.find((a) => a.id === id);

      // 在测试前清除上一次的测试结果
      setTestResults((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });

      setTestResults((prev) => ({ ...prev, [id]: '正在思考...' }));

      if (agent?.streaming) {
        let fullContent = '';
        await agentService.runAgentStream(id, input, testDate, (chunk) => {
          if (chunk.type === 'error') {
            fullContent += `\n[错误: ${chunk.error}]\n`;
            setTestResults((prev) => ({ ...prev, [id]: fullContent || '无响应内容' }));
          } else if (chunk.type === 'content') {
            fullContent += chunk.content;
            setTestResults((prev) => ({ ...prev, [id]: fullContent || '正在思考...' }));
          } else if (chunk.type === 'tool_start') {
            const argsText = chunk.args === undefined ? '' : ` args=${JSON.stringify(chunk.args)}`;
            fullContent += `\n[调用工具: ${chunk.tool}${argsText}...]\n`;
            setTestResults((prev) => ({ ...prev, [id]: fullContent || '正在思考...' }));
          } else if (chunk.type === 'tool_error') {
            fullContent += `\n[工具错误: ${chunk.error}]\n`;
            setTestResults((prev) => ({ ...prev, [id]: fullContent || '正在思考...' }));
          } else if (chunk.type === 'trace_observation') {
            const obs = chunk.observation;
            fullContent += `\n[观察: ${obs.toolName} ${obs.success ? '成功' : '失败'}，耗时 ${obs.durationMs}ms]\n`;
            setTestResults((prev) => ({ ...prev, [id]: fullContent || '正在思考...' }));
          } else if (chunk.type === 'final_trace') {
            fullContent += `\n[停止原因: ${chunk.stopReason}]\n`;
            setTestResults((prev) => ({ ...prev, [id]: fullContent || '正在思考...' }));
          } else if (chunk.type === 'final_content') {
            // fullContent is already updated by 'content' chunks
          }
        });
        setTestResults((prev) => ({ ...prev, [id]: fullContent || '无响应内容' }));
      } else {
        const result = await agentService.runAgent(id, input, testDate);
        const traceSummary = result.trace?.rounds?.length
          ? [
              '',
              '--- ReAct Trace ---',
              ...result.trace.rounds.flatMap((round) => [
                `Round ${round.index}`,
                round.toolCalls.length
                  ? `Action: ${round.toolCalls.map((call) => call.name).join(', ')}`
                  : 'Action: final',
                ...round.toolCalls.map(
                  (call) => `Args: ${call.name} ${JSON.stringify(call.arguments ?? {})}`
                ),
                ...round.observations.map(
                  (obs) =>
                    `Observation: ${obs.toolName} ${obs.success ? '成功' : `失败: ${obs.error || ''}`} (${obs.durationMs}ms)`
                )
              ]),
              `Stop: ${result.stopReason || 'final'}`
            ].join('\n')
          : '';
        setTestResults((prev) => ({
          ...prev,
          [id]: `${result.content || '无响应内容'}${traceSummary}`
        }));
      }
    } catch (error: any) {
      setTestResults((prev) => ({ ...prev, [id]: `错误: ${error.message}` }));
    }
  };

  const handleStartPlatformRun = async (id: string, input: string) => {
    if (!input.trim()) return;
    try {
      const started = await agentService.startAgentRun({
        agentId: id,
        message: input.trim(),
        date: testDate || undefined
      });
      toastSuccess(`平台 Run 已启动：${started.runId.slice(-12)}`);
      navigate(`/ops?tab=runs&runId=${encodeURIComponent(started.runId)}`);
    } catch (error: unknown) {
      toastError(error instanceof Error ? error.message : '启动平台 Run 失败');
    }
  };

  const tabs = [
    { id: 'agents', label: '智能体 (Agents)', icon: 'smart_toy' },
    { id: 'tools', label: '工具箱 (Tools)', icon: 'construction' },
    { id: 'skills', label: '技能库 (Skills)', icon: 'bolt' },
    { id: 'workflows', label: '工作流 (Workflows)', icon: 'account_tree' }
  ];

  const handleUploadSkill = async (file: File) => {
    if (!file.name.endsWith('.zip')) {
      setUploadError('请上传 .zip 格式的压缩包');
      return;
    }
    try {
      setIsUploading(true);
      setUploadError(null);
      await agentService.uploadSkill(file);
      await loadData();
    } catch (error: any) {
      setUploadError(error.message || '上传失败');
    } finally {
      setIsUploading(false);
      if (skillFileRef.current) skillFileRef.current.value = '';
    }
  };

  const handleScanSkills = async () => {
    try {
      setIsScanningSkills(true);
      setUploadError(null);
      const result = (await agentService.scanSkills()) as SkillScanResult;
      await loadData();

      if (previewSkill) {
        const refreshedSkills = await agentService.getSkills();
        const updatedPreviewSkill =
          refreshedSkills.find((skill: Skill) => skill.id === previewSkill.id) || null;
        setPreviewSkill(updatedPreviewSkill);
      }

      toastSuccess(
        `扫描完成：共 ${result.scanned} 个，本次新增 ${result.added} 个，更新 ${result.updated} 个，移除 ${result.removed} 个旧内置技能`
      );
    } catch (error: any) {
      const msg = error.message || '扫描失败';
      setUploadError(msg);
      toastError(msg);
    } finally {
      setIsScanningSkills(false);
    }
  };

  const handleDeleteSkill = async (id: string) => {
    if (
      !(await showConfirm({
        title: '删除技能',
        message: '确定删除该技能吗？',
        confirmLabel: '删除',
        variant: 'danger',
        confirmTone: 'danger'
      }))
    )
      return;
    try {
      await agentService.deleteSkill(id);
      await loadData();
      if (previewSkill?.id === id) setPreviewSkill(null);
      toastSuccess('技能已删除');
    } catch (error) {
      toastError('删除失败');
    }
  };

  const handlePreviewSkill = async (skill: Skill) => {
    setPreviewSkill(skill);
    setSelectedFilePath(null);
    setSelectedFileContent(null);
    try {
      const result = await agentService.getSkillFiles(skill.id);
      setSkillFileTree(result.files || []);
    } catch {
      setSkillFileTree([]);
    }
  };

  const handleSelectFile = async (skillId: string, filePath: string) => {
    setSelectedFilePath(filePath);
    setSelectedFileContent(null);
    setIsLoadingFile(true);
    try {
      const result = await agentService.getSkillFileContent(skillId, filePath);
      setSelectedFileContent(result.content);
    } catch {
      setSelectedFileContent('// 无法读取文件内容');
    } finally {
      setIsLoadingFile(false);
    }
  };

  const handleSaveFile = async () => {
    if (!previewSkill || !selectedFilePath || selectedFileContent === null) return;
    try {
      setIsSaving(true);
      await agentService.saveSkillFileContent(
        previewSkill.id,
        selectedFilePath,
        selectedFileContent
      );
      // 重新加载数据以刷新列表中的指令等信息
      await loadData();

      // 更新当前预览的技能对象，以同步名称和描述
      const updatedSkill = await agentService
        .getSkills()
        .then((skills: Skill[]) => skills.find((s) => s.id === previewSkill.id));
      if (updatedSkill) {
        setPreviewSkill(updatedSkill);
      }
      toastSuccess('文件保存成功');
    } catch (error: any) {
      toastError(`保存失败: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveMCP = async (config: MCPServerConfig) => {
    const trimmedId = config.id.trim();
    const fmtErr = getEntityIdFormatError(trimmedId);
    if (fmtErr) {
      toastError(fmtErr);
      return;
    }
    const orig = mcpOriginalIdRef.current;
    if (isResourceIdTaken(mcpConfigs, trimmedId, orig)) {
      toastError('该 ID 已被其他 MCP 配置使用');
      return;
    }
    const toSave = { ...config, id: trimmedId };
    if (orig && orig !== trimmedId) {
      const ok = await showConfirm({
        title: '修改 MCP ID',
        message:
          '修改 MCP ID 将保存为新 ID 并删除旧记录；已绑定该 MCP 的智能体需改为新 ID。是否继续？',
        confirmLabel: '继续保存'
      });
      if (!ok) return;
    }
    try {
      setIsSaving(true);
      await agentService.saveMCPConfig(toSave);
      if (orig && orig !== trimmedId) {
        await agentService.deleteMCPConfig(orig);
      }
      await loadData();
      setEditingMCP(null);
      toastSuccess('MCP 配置保存成功');
    } catch (error) {
      toastError('保存 MCP 配置失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMCP = async (id: string) => {
    if (
      !(await showConfirm({
        title: '删除 MCP',
        message: '确定删除该 MCP 配置吗？',
        confirmLabel: '删除',
        variant: 'danger',
        confirmTone: 'danger'
      }))
    )
      return;
    try {
      await agentService.deleteMCPConfig(id);
      await loadData();
      toastSuccess('MCP 配置已删除');
    } catch (error) {
      toastError('删除失败');
    }
  };

  const createEmptyMCP = (): MCPServerConfig => ({
    id: `mcp_${Date.now().toString(36)}`,
    name: '',
    description: '',
    transportType: 'stdio',
    command: '',
    args: [],
    url: '',
    headers: {},
    env: {},
    enabled: true
  });

  const createEmptyWorkflow = (): Workflow => ({
    id: `wf_${Date.now().toString(36)}`,
    name: '',
    description: '',
    steps: [
      {
        id: 'step_1',
        type: 'agent',
        displayName: '新步骤',
        agentId: '',
        nextStepIds: [],
        condition: ''
      }
    ],
    initialStepId: 'step_1'
  });

  const handleSaveWorkflow = async (workflow: Workflow) => {
    const trimmedId = workflow.id.trim();
    const fmtErr = getEntityIdFormatError(trimmedId);
    if (fmtErr) {
      toastError(fmtErr);
      return;
    }
    const orig = workflowOriginalIdRef.current;
    if (isResourceIdTaken(workflows, trimmedId, orig)) {
      toastError('该 ID 已被其他工作流使用');
      return;
    }
    const toSave = {
      ...workflow,
      id: trimmedId,
      steps: workflow.steps.map((step) => normalizeWorkflowStepInputTemplate(step))
    };
    if (orig && orig !== trimmedId) {
      const ok = await showConfirm({
        title: '修改工作流 ID',
        message: '修改工作流 ID 将保存为新 ID 并删除旧记录；外部若引用旧 ID 需自行更新。是否继续？',
        confirmLabel: '继续保存'
      });
      if (!ok) return;
    }
    try {
      setIsSaving(true);
      let payload = toSave;
      if (editingWorkflowTemplateVars) {
        const applied = applyTemplateVariableValues(toSave, agents, editingWorkflowTemplateVars);
        payload = applied.workflow;
        for (const agent of applied.updatedAgents) {
          await agentService.saveAgent(agent);
        }
      }
      await agentService.saveWorkflow(payload);
      if (orig && orig !== trimmedId) {
        await agentService.deleteWorkflow(orig);
      }
      await loadData();
      closeWorkflowEditor();
      toastSuccess('工作流保存成功');
    } catch (error) {
      toastError('保存工作流失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteWorkflow = async (id: string) => {
    if (
      !(await showConfirm({
        title: '删除工作流',
        message: '确定删除该工作流吗？',
        confirmLabel: '删除',
        variant: 'danger',
        confirmTone: 'danger'
      }))
    )
      return;
    try {
      await agentService.deleteWorkflow(id);
      await loadData();
      toastSuccess('工作流已删除');
    } catch (error) {
      toastError('删除失败');
    }
  };

  const handleExportWorkflow = (workflow: Workflow) => {
    const blob = new Blob([JSON.stringify(workflow, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${workflow.id || 'workflow'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportWorkflowFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Workflow;
      if (!parsed.id || !Array.isArray(parsed.steps)) {
        throw new Error('不是有效的工作流 JSON');
      }
      workflowOriginalIdRef.current = null;
      openWorkflowEditor(parsed, null);
      toastSuccess('工作流 JSON 已载入，可检查后保存');
    } catch (error: any) {
      toastError(error.message || '导入工作流失败');
    }
  };

  const handleUseWorkflowTemplate = async (templateId: string) => {
    const tpl = workflowTemplates.find((t) => t.id === templateId);
    const defaults = Object.fromEntries(
      (tpl?.variables || []).map((v) => [v.id, String(v.defaultValue ?? '')])
    );
    const providerId =
      String(defaults.providerId || '') ||
      settings.ACTIVE_AI_PROVIDER_ID ||
      aiProviders.find((provider: any) => provider.enabled !== false)?.id ||
      aiProviders[0]?.id ||
      '';
    const provider = aiProviders.find((p: any) => p.id === providerId);
    const model = String(defaults.model || '') || provider?.models?.[0] || '';
    setSelectedWorkflowTemplateId(templateId);
    setTemplateVariables({ ...defaults, providerId, model });
  };

  const handleInstantiateWorkflowTemplate = async () => {
    if (!selectedWorkflowTemplateId) return;
    try {
      setIsInstantiatingTemplate(true);
      const result = await agentService.instantiateWorkflowTemplate(selectedWorkflowTemplateId, {
        variables: templateVariables,
        conflictStrategy: 'copy'
      });
      await loadData();
      setShowWorkflowTemplates(false);
      setSelectedWorkflowTemplateId(null);
      toastSuccess(
        `已创建 ${result.createdAgents.length} 个智能体、${result.createdWorkflows.length} 个工作流`
      );
    } catch (error: any) {
      toastError(error.message || '创建模板失败');
    } finally {
      setIsInstantiatingTemplate(false);
    }
  };

  const handleRunWorkflow = async (id: string, input: string) => {
    try {
      // 在测试前清除上一次的测试结果
      setWorkflowTestResult((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });

      setWorkflowTestResult((prev) => ({ ...prev, [id]: '正在思考...' }));
      const result = await agentService.runWorkflow(id, input, testDate);
      let content = '';
      if (result) {
        if (typeof result === 'string') content = result;
        else if (result && typeof result.content === 'string') content = result.content;
        else content = JSON.stringify(result, null, 2);
      }
      setWorkflowTestResult((prev) => ({ ...prev, [id]: content || '无响应内容' }));
    } catch (error: any) {
      setWorkflowTestResult((prev) => ({ ...prev, [id]: `错误: ${error.message}` }));
    }
  };

  const addWorkflowStep = (typeToAdd: string) => {
    if (!editingWorkflow) return;
    const existingIds = editingWorkflow.steps.map((s) => s.id);
    let idx = editingWorkflow.steps.length + 1;
    while (existingIds.includes(`step_${idx}`)) idx++;
    const id = `step_${idx}`;
    const def = stepCatalog.getDef(typeToAdd);
    const newStep = createStepFromCatalog(def, id, `步骤 ${idx}`);
    setEditingWorkflow({ ...editingWorkflow, steps: [...editingWorkflow.steps, newStep] });
    setSelectedStepId(id);
  };

  const moveWorkflowStep = (idx: number, dir: -1 | 1) => {
    if (!editingWorkflow) return;
    const j = idx + dir;
    if (j < 0 || j >= editingWorkflow.steps.length) return;
    const next = [...editingWorkflow.steps];
    [next[idx], next[j]] = [next[j], next[idx]];
    setEditingWorkflow({ ...editingWorkflow, steps: next });
  };

  const updateWorkflowStep = (stepIdx: number, patch: Partial<WorkflowStep>) => {
    if (!editingWorkflow) return;
    const steps = editingWorkflow.steps.map((s, i) => (i === stepIdx ? { ...s, ...patch } : s));
    setEditingWorkflow({ ...editingWorkflow, steps });
  };

  const removeWorkflowStep = (stepIdx: number) => {
    if (!editingWorkflow || editingWorkflow.steps.length <= 1) return;
    const removedId = editingWorkflow.steps[stepIdx].id;
    const removedNextIds = getNextStepIds(editingWorkflow.steps[stepIdx]);
    const steps = editingWorkflow.steps.filter((_, i) => i !== stepIdx);
    // Fix links: any step referencing removed step in nextStepIds gets it replaced with removed step's successors
    const fixedSteps = steps.map((s) => {
      const nexts = getNextStepIds(s);
      if (nexts.includes(removedId)) {
        const updated = [...nexts.filter((id) => id !== removedId), ...removedNextIds].filter(
          (v, i, a) => a.indexOf(v) === i
        );
        return { ...s, nextStepIds: updated };
      }
      return s;
    });
    const newInitial =
      editingWorkflow.initialStepId === removedId
        ? fixedSteps[0]?.id
        : editingWorkflow.initialStepId;
    setEditingWorkflow({ ...editingWorkflow, steps: fixedSteps, initialStepId: newInitial });
  };

  const getStepLabel = (step: WorkflowStep) =>
    getWorkflowStepLabel(step, agents, tools, workflows, {
      typeLabel: stepCatalog.getDef(step.type)?.label
    });

  // Build topological layers for DAG visualization
  const buildTopologicalLayers = (
    steps: WorkflowStep[],
    initialStepId: string
  ): WorkflowStep[][] => {
    if (steps.length === 0) return [];
    const stepMap = new Map(steps.map((s) => [s.id, s]));
    const stepIds = new Set(steps.map((s) => s.id));

    // Build in-degree from nextStepIds edges
    const inDegree = new Map<string, number>();
    const successors = new Map<string, Set<string>>();
    for (const s of steps) {
      inDegree.set(s.id, 0);
      successors.set(s.id, new Set());
    }

    for (const s of steps) {
      const nexts = getNextStepIds(s);
      for (const nid of nexts) {
        if (stepIds.has(nid)) {
          successors.get(s.id)!.add(nid);
          inDegree.set(nid, (inDegree.get(nid) || 0) + 1);
        }
      }
    }

    // BFS topological sort by layers
    const layers: WorkflowStep[][] = [];
    let queue = steps.filter((s) => (inDegree.get(s.id) || 0) === 0);
    const visited = new Set<string>();

    // If no zero-indegree nodes, start with initialStepId
    if (queue.length === 0 && stepMap.has(initialStepId)) {
      queue = [stepMap.get(initialStepId)!];
    }

    while (queue.length > 0) {
      layers.push(queue);
      const nextQueue: WorkflowStep[] = [];
      for (const s of queue) {
        visited.add(s.id);
        for (const nid of successors.get(s.id) || []) {
          const newDeg = (inDegree.get(nid) || 1) - 1;
          inDegree.set(nid, newDeg);
          if (newDeg === 0 && !visited.has(nid)) {
            nextQueue.push(stepMap.get(nid)!);
          }
        }
      }
      queue = nextQueue;
    }

    // Add any remaining unvisited steps as final layer
    const remaining = steps.filter((s) => !visited.has(s.id));
    if (remaining.length > 0) layers.push(remaining);

    return layers;
  };

  const buildWorkflowGraphLayout = (
    steps: WorkflowStep[],
    initialStepId: string,
    nodeHeight: number,
    compact = false
  ) => {
    const layers = buildTopologicalLayers(steps, initialStepId);
    const layerGap = compact ? 120 : 190;
    const nodeGap = compact ? 46 : 64;
    const paddingX = compact ? 20 : 40;
    const paddingY = compact ? 16 : 24;
    const nodeWidth = compact ? 98 : 132;

    // 1. Calculate rough positions (relative to first node of max layer)
    const roughPositions = new Map<string, { x: number; y: number; layerIndex: number }>();
    let maxRows = 0;
    layers.forEach((l) => {
      if (l.length > maxRows) maxRows = l.length;
    });

    layers.forEach((layer, li) => {
      const startY = ((maxRows - layer.length) * nodeGap) / 2;
      layer.forEach((step, idx) => {
        roughPositions.set(step.id, {
          x: li * layerGap,
          y: startY + idx * nodeGap,
          layerIndex: li
        });
      });
    });

    const edges: Array<{ from: string; to: string }> = [];
    const idSet = new Set(steps.map((s) => s.id));
    steps.forEach((step) => {
      getNextStepIds(step).forEach((nextId) => {
        if (idSet.has(nextId)) edges.push({ from: step.id, to: nextId });
      });
    });

    // 2. Calculate content bounding box (including curves)
    let minX = 0,
      minY = 0,
      maxX = 0,
      maxY = 0;
    const checkPoint = (x: number, y: number) => {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    };

    roughPositions.forEach((pos) => {
      checkPoint(pos.x, pos.y);
      checkPoint(pos.x + nodeWidth, pos.y + nodeHeight);
    });

    edges.forEach((edge) => {
      const from = roughPositions.get(edge.from);
      const to = roughPositions.get(edge.to);
      if (from && to) {
        const y1 = from.y + nodeHeight / 2;
        const y2 = to.y + nodeHeight / 2;
        const layerSpan = Math.max(1, to.layerIndex - from.layerIndex);
        if (layerSpan > 1) {
          const lift = 24 + (layerSpan - 1) * 14;
          checkPoint(from.x + nodeWidth + 20, y1 - lift);
          checkPoint(to.x - 20, y2 - lift);
        }
      }
    });

    // 3. Determine final dimensions and centering offsets
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    const minWidth = compact ? 180 : 300;
    const minHeight = compact ? 100 : 160;

    const finalWidth = Math.max(minWidth, contentWidth + paddingX * 2);
    const finalHeight = Math.max(minHeight, contentHeight + paddingY * 2);

    const offsetX = (finalWidth - contentWidth) / 2 - minX;
    const offsetY = (finalHeight - contentHeight) / 2 - minY;

    const positions = new Map<string, { x: number; y: number; layerIndex: number }>();
    roughPositions.forEach((pos, id) => {
      positions.set(id, { ...pos, x: pos.x + offsetX, y: pos.y + offsetY });
    });

    return { positions, edges, width: finalWidth, height: finalHeight };
  };

  const renderWorkflowGraphPreview = (
    steps: WorkflowStep[],
    initialStepId: string,
    compact = false
  ) => {
    const nodeHeight = compact ? 24 : 34;
    const layout = buildWorkflowGraphLayout(steps, initialStepId, nodeHeight, compact);
    const nodeWidth = compact ? 108 : 156;

    return (
      <div className="inline-block min-w-max py-2">
        <div
          className="relative shrink-0"
          style={{
            width: `${layout.width}px`,
            minWidth: `${layout.width}px`,
            height: `${layout.height}px`
          }}
        >
          <svg
            className="absolute inset-0 pointer-events-none"
            width={layout.width}
            height={layout.height}
          >
            {layout.edges.map((edge, idx) => {
              const from = layout.positions.get(edge.from);
              const to = layout.positions.get(edge.to);
              if (!from || !to) return null;

              const x1 = from.x + nodeWidth;
              const y1 = from.y + nodeHeight / 2;
              const x2 = to.x;
              const y2 = to.y + nodeHeight / 2;
              const c1x = x1 + Math.max(20, (x2 - x1) / 2);
              const c2x = x2 - Math.max(20, (x2 - x1) / 2);
              const layerSpan = Math.max(1, to.layerIndex - from.layerIndex);
              const curveOffset = layerSpan > 1 ? -(24 + (layerSpan - 1) * 14) : 0;
              const c1y = y1 + curveOffset;
              const c2y = y2 + curveOffset;

              return (
                <path
                  key={`edge_${edge.from}_${edge.to}_${idx}`}
                  d={`M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`}
                  fill="none"
                  stroke={
                    layerSpan > 1
                      ? compact
                        ? 'rgba(245, 158, 11, 0.88)'
                        : 'rgba(245, 158, 11, 0.75)'
                      : compact
                        ? 'rgba(148, 163, 184, 0.58)'
                        : 'rgba(148, 163, 184, 0.72)'
                  }
                  strokeWidth={layerSpan > 1 ? (compact ? 2 : 1.8) : compact ? 1.35 : 1.5}
                  strokeDasharray={compact && layerSpan > 1 ? '0' : undefined}
                />
              );
            })}
          </svg>

          {steps.map((step) => {
            const pos = layout.positions.get(step.id);
            if (!pos) return null;
            const def = stepCatalog.getDef(step.type);
            const color = def?.color || 'slate';
            const iconName = def?.icon || (step.enabled === false ? 'visibility_off' : 'settings');
            return (
              <div
                key={`node_${step.id}`}
                className={`absolute inline-flex items-center gap-1.5 border font-semibold shadow-subtle transition-all ${
                  compact
                    ? 'px-2 py-0.5 text-[9px] rounded-lg'
                    : 'px-3 py-1.5 text-[10px] rounded-2xl'
                } ${
                  step.enabled === false
                    ? 'bg-surface/50 dark:bg-canvas/[0.02] text-text-stone dark:text-text-charcoal border-hairline-soft/30 dark:border-white/5 opacity-60 grayscale'
                    : DAG_NODE_BG[color]
                } ${
                  step.id === initialStepId
                    ? 'ring-2 ring-emerald-500/20 dark:ring-emerald-500/40'
                    : ''
                }`}
                style={{
                  left: `${pos.x}px`,
                  top: `${pos.y}px`,
                  width: `${nodeWidth}px`,
                  minHeight: `${nodeHeight}px`
                }}
                title={step.id + (step.enabled === false ? ' (已禁用)' : '')}
              >
                <div
                  className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${
                    step.enabled === false
                      ? 'bg-hairline/50 dark:bg-canvas/5 text-text-stone'
                      : DAG_ICON_BG[color]
                  }`}
                >
                  <span className="material-symbols-outlined text-[12px]">{iconName}</span>
                </div>
                <span className="truncate">{getStepLabel(step)}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <>
      <AgentsPageShell
        tabs={tabs}
        activeTab={activeTab}
        isLoading={isLoading}
        onTabChange={setActiveTab}
      >
        <>
          {activeTab === 'agents' && (
            <AgentsTab
              agents={agents}
              skills={skills}
              tools={tools}
              settings={settings}
              mcpConfigs={mcpConfigs}
              agentTools={agentTools}
              editingAgent={editingAgent}
              foldedGroups={foldedGroups}
              testingAgentId={testingAgentId}
              testInput={testInput}
              testResults={testResults}
              testDate={testDate}
              isSaving={isSaving}
              agentOriginalIdRef={agentOriginalIdRef}
              openAiBuilder={openAiBuilder}
              getToolDisplayName={getToolDisplayName}
              formatBindingSummary={formatBindingSummary}
              handleAgentToolClick={handleAgentToolClick}
              handleAgentToolDisable={handleAgentToolDisable}
              setFoldedGroups={setFoldedGroups}
              setEditingAgent={setEditingAgent}
              setTestingAgentId={setTestingAgentId}
              setTestInput={setTestInput}
              setTestResults={setTestResults}
              setTestDate={setTestDate}
              handleDeleteAgent={handleDeleteAgent}
              handleSaveAgent={handleSaveAgent}
              handleRunAgent={handleRunAgent}
              handleStartPlatformRun={handleStartPlatformRun}
              onViewAgentRuns={(agentId) => navigate(`/ops?tab=runs&agentId=${encodeURIComponent(agentId)}`)}
              handleCopy={handleCopy}
              handleImportAsDataSource={handleImportAsDataSource}
            />
          )}
          {activeTab === 'skills' && (
            <SkillsTab
              skills={skills}
              uploadError={uploadError}
              isUploading={isUploading}
              isScanningSkills={isScanningSkills}
              isDragging={isDragging}
              previewSkill={previewSkill}
              skillFileTree={skillFileTree}
              selectedFilePath={selectedFilePath}
              selectedFileContent={selectedFileContent}
              isLoadingFile={isLoadingFile}
              isSaving={isSaving}
              skillFileRef={skillFileRef}
              openAiBuilder={openAiBuilder}
              handleUploadSkill={handleUploadSkill}
              handleScanSkills={handleScanSkills}
              handlePreviewSkill={handlePreviewSkill}
              handleSelectFile={handleSelectFile}
              handleSaveFile={handleSaveFile}
              handleDeleteSkill={handleDeleteSkill}
              setUploadError={setUploadError}
              setIsDragging={setIsDragging}
              setPreviewSkill={setPreviewSkill}
              setSelectedFileContent={setSelectedFileContent}
            />
          )}
          {activeTab === 'tools' && (
            <ToolsTab
              visibleToolCatalog={visibleToolCatalog}
              mcpConfigs={mcpConfigs}
              editingMCP={editingMCP}
              isSaving={isSaving}
              mcpOriginalIdRef={mcpOriginalIdRef}
              getToolDisplayName={getToolDisplayName}
              setExecutingTool={setExecutingTool}
              setToolArguments={setToolArguments}
              setToolExecutionResult={setToolExecutionResult}
              setEditingMCP={setEditingMCP}
              createEmptyMCP={createEmptyMCP}
              handleDeleteMCP={handleDeleteMCP}
              handleSaveMCP={handleSaveMCP}
              foldedGroups={foldedGroups}
              setFoldedGroups={setFoldedGroups}
            />
          )}
          {activeTab === 'workflows' && (
            <WorkflowsTab
              workflows={workflows}
              workflowTemplates={workflowTemplates}
              editingWorkflow={editingWorkflow}
              editingWorkflowTemplate={editingWorkflowTemplate}
              editingWorkflowTemplateVars={editingWorkflowTemplateVars}
              showWorkflowTemplates={showWorkflowTemplates}
              selectedWorkflowTemplateId={selectedWorkflowTemplateId}
              templateVariables={templateVariables}
              isInstantiatingTemplate={isInstantiatingTemplate}
              testingWorkflowId={testingWorkflowId}
              workflowTestInput={workflowTestInput}
              workflowTestResult={workflowTestResult}
              testDate={testDate}
              selectedStepId={selectedStepId}
              stepPickerOpen={stepPickerOpen}
              isSaving={isSaving}
              aiProviders={aiProviders}
              workflowOriginalIdRef={workflowOriginalIdRef}
              stepCatalog={stepCatalog}
              openAiBuilder={openAiBuilder}
              createEmptyWorkflow={createEmptyWorkflow}
              setShowWorkflowTemplates={setShowWorkflowTemplates}
              setSelectedWorkflowTemplateId={setSelectedWorkflowTemplateId}
              setTemplateVariables={setTemplateVariables}
              setEditingWorkflow={setEditingWorkflow}
              setEditingWorkflowTemplateVars={setEditingWorkflowTemplateVars}
              setTestingWorkflowId={setTestingWorkflowId}
              setWorkflowTestInput={setWorkflowTestInput}
              setWorkflowTestResult={setWorkflowTestResult}
              setTestDate={setTestDate}
              setSelectedStepId={setSelectedStepId}
              setStepPickerOpen={setStepPickerOpen}
              handleImportWorkflowFile={handleImportWorkflowFile}
              handleExportWorkflow={handleExportWorkflow}
              handleDeleteWorkflow={handleDeleteWorkflow}
              openWorkflowEditor={openWorkflowEditor}
              closeWorkflowEditor={closeWorkflowEditor}
              handleUseWorkflowTemplate={handleUseWorkflowTemplate}
              handleInstantiateWorkflowTemplate={handleInstantiateWorkflowTemplate}
              patchEditingWorkflowTemplateVar={patchEditingWorkflowTemplateVar}
              handleSaveWorkflow={handleSaveWorkflow}
              moveWorkflowStep={moveWorkflowStep}
              updateWorkflowStep={updateWorkflowStep}
              removeWorkflowStep={removeWorkflowStep}
              addWorkflowStep={addWorkflowStep}
              handleRunWorkflow={handleRunWorkflow}
              handleCopy={handleCopy}
              handleImportAsDataSource={handleImportAsDataSource}
              toastError={toastError}
              renderWorkflowGraphPreview={renderWorkflowGraphPreview}
            />
          )}
        </>
      </AgentsPageShell>

      <AnimatePresence>
        {executingTool && (
          <ToolExecutionModal
            executingTool={executingTool}
            toolArguments={toolArguments}
            toolExecutionResult={toolExecutionResult}
            isExecutingTool={isExecutingTool}
            onClose={() => setExecutingTool(null)}
            onChangeArguments={setToolArguments}
            onExecute={handleExecuteTool}
            onCopy={handleCopy}
            onImportAsDataSource={handleImportAsDataSource}
          />
        )}
      </AnimatePresence>

      {editingAgent && categoryPicker && (
        <CategoryPickerModal
          isOpen
          title={AGENT_TOOL_CATEGORY_CONFIG[categoryPicker.toolId]?.title || '选择分类'}
          description={AGENT_TOOL_CATEGORY_CONFIG[categoryPicker.toolId]?.description}
          categories={getCategoriesForTool(categoryPicker.toolId)}
          selectedIds={getAgentCategoryBindingIds(editingAgent, categoryPicker.toolId)}
          onClose={() => {
            if (categoryPicker.mode === 'enable') {
              /* 取消启用：不修改 agent */
            }
            setCategoryPicker(null);
          }}
          onConfirm={handleCategoryPickerConfirm}
        />
      )}

      <AnimatePresence>
        {!aiBuilderOpen && (
          <motion.button
            key="ai-builder-fab"
            type="button"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            onClick={() => openAiBuilder()}
            className="fixed bottom-4 right-4 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full bg-ink text-white shadow-modal transition-colors hover:bg-charcoal sm:bottom-6 sm:right-6 sm:h-14 sm:w-14 dark:bg-canvas dark:text-ink"
            title={aiBuilderBackgroundActive ? 'AI Builder（后台任务运行中）' : 'AI Builder'}
          >
            {aiBuilderBackgroundActive && (
              <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 animate-pulse rounded-full bg-amber-400 ring-2 ring-slate-900 dark:ring-white" />
            )}
            <span className="material-symbols-outlined text-2xl leading-none">auto_awesome</span>
          </motion.button>
        )}
      </AnimatePresence>
      <AiBuilderPanel
        open={aiBuilderOpen}
        initialMention={aiBuilderInitialMention}
        agents={agents}
        skills={skills}
        workflows={workflows}
        settings={settings}
        onClose={() => setAiBuilderOpen(false)}
        onApplied={loadData}
        onError={toastError}
        onSuccess={toastSuccess}
        onInitialMentionConsumed={() => setAiBuilderInitialMention(null)}
        onBackgroundActivityChange={setAiBuilderBackgroundActive}
      />
    </>
  );
};

export default Agents;
