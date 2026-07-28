import { useState, useEffect, useRef } from 'react';
import { workflowRunStore, type WorkflowRunSnapshot } from '../../stores/workflowRunStore';
import { useLocation } from 'react-router-dom';
import { devLogger } from '../../utils/devLogger';
import { publishContent } from '../../services/contentService';
import { agentService } from '../../services/agentService';
import type { Agent, Workflow, Tool } from '../../services/agentService';
import {
  saveToCache,
  loadFromCache,
  CACHE_KEYS,
  clearExpiredCache,
  clearAllCache,
  clearGenerationCacheForDate
} from '../../utils/cacheUtils';
import { getSettings } from '../../services/settingsService';
import ContentRenderer from '../../components/UI/LazyContentRenderer';
import DailyReportJsonPreview, {
  type DailyReportJson
} from '../../components/UI/DailyReportJsonPreview';
import { request } from '../../services/api';
import { useToast } from '../../context/ToastContext.js';
import { useMessageDialog } from '../../context/MessageDialogContext';
import { copyToClipboard as copyToClipboardUtil } from '../../utils/clipboardUtils';
import { getPublisherPlugin } from '../../plugins/publishers';
import { getTodayShanghai } from '../../utils/dateUtils';
import GenerationPageShell from './GenerationPageShell';
import WorkflowProgressPanel from './WorkflowProgressPanel';
import GenerationMobileTabBar from './GenerationMobileTabBar';
import { AnimatedPillTabs } from '../../components/UI/ScrollablePillNav';
import EditorialDecisionPanel from './EditorialDecisionPanel';
import type { EditorialPlan } from '../../types/dailyEditorial';
import { resolveItemSnippet, resolveRawDescription } from '../../utils/dailyInputMode';

/** 提交工作流时去掉 UI 勾选态字段，其余字段（原文 + AI 摘要）完整保留，由工作流自行处理。 */
function toWorkflowInputItems(items: any[]) {
  return items.map(({ selected, ...rest }: any) => rest);
}

function isValidDailyReportJson(value: unknown): value is DailyReportJson {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return Array.isArray(v.headlines) && Array.isArray(v.sections);
}

function prettyReportJson(report: unknown): string {
  try {
    return JSON.stringify(report, null, 2);
  } catch {
    return '';
  }
}

const Generation: React.FC = () => {
  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast();
  const { confirm: showConfirm } = useMessageDialog();
  const location = useLocation();
  const {
    date: initialDate,
    result: initialResult,
    selectedIds: initialSelectedIds,
    selectedItems: initialSelectedItems,
    feedItems: routeFeedItems
  } = (location.state as any) || {};
  const routeSelectedItems = initialSelectedItems || routeFeedItems || null;

  const [date, setDate] = useState(initialDate || getTodayShanghai());
  const [editorialPlan, setEditorialPlan] = useState<EditorialPlan | null>(null);
  const [result, setResult] = useState(initialResult || null);
  const [selectedIds, setSelectedIds] = useState(initialSelectedIds || null);
  const [selectedItems, setSelectedItems] = useState(routeSelectedItems);
  const [committing, setCommitting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState(initialResult ? '草稿已生成' : '');
  const [previewMode, setPreviewMode] = useState<'markdown' | 'preview'>('preview');
  const [imageProxy, setImageProxy] = useState('');
  const [jsonEditText, setJsonEditText] = useState(() =>
    initialResult?.daily_report_json ? prettyReportJson(initialResult.daily_report_json) : ''
  );
  const [jsonEditError, setJsonEditError] = useState<string | null>(null);

  // Publishers Metadata
  const [publishers, setPublishers] = useState<any[]>([]);

  // Commit target picker
  const [showCommitPicker, setShowCommitPicker] = useState(false);
  const [activePublisher, setActivePublisher] = useState<string | null>(null);

  // Item Preview
  const [previewItem, setPreviewItem] = useState<any | null>(null);

  // AI Execution Picker
  const [showAIPicker, setShowAIPicker] = useState(false);
  const [aiPickerTab, setAiPickerTab] = useState<'recent' | 'workflow' | 'agent' | 'tool'>(
    'recent'
  );
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [aiPickerLoading, setAiPickerLoading] = useState(false);

  // Tool execution state
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [toolArguments, setToolArguments] = useState<Record<string, any>>({});

  // Mobile layout state
  const [mobileTab, setMobileTab] = useState<'source' | 'preview'>('preview');

  const channelRef = useRef<BroadcastChannel | null>(null);
  const mountedRef = useRef(true);
  const lastSyncedWorkflowRunId = useRef('');
  const [wfRun, setWfRun] = useState<WorkflowRunSnapshot>(() => workflowRunStore.getSnapshot());

  const resetGenerationPreview = (statusMessage = '待命') => {
    lastSyncedWorkflowRunId.current = '';
    workflowRunStore.clearSession();
    setResult(null);
    setEditorialPlan(null);
    setJsonEditText('');
    setJsonEditError(null);
    setHistoryState({ list: [], index: -1 });
    setGenerating(false);
    setStatus(statusMessage);
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // 工作流写入新 JSON 时同步编辑草稿
  useEffect(() => {
    if (result?.daily_report_json) {
      setJsonEditText(prettyReportJson(result.daily_report_json));
      setJsonEditError(null);
    } else {
      setJsonEditText('');
      setJsonEditError(null);
    }
  }, [result?.daily_report_json]);

  const applyJsonEditText = (text: string): boolean => {
    try {
      const parsed = JSON.parse(text);
      if (!isValidDailyReportJson(parsed)) {
        setJsonEditError('JSON 需包含 headlines 与 sections 数组');
        return false;
      }
      setJsonEditError(null);
      setResult((prev: any) =>
        prev
          ? {
              ...prev,
              daily_report_json: parsed,
              daily_summary_markdown: JSON.stringify(parsed, null, 2)
            }
          : {
              daily_report_json: parsed,
              daily_summary_markdown: JSON.stringify(parsed, null, 2)
            }
      );
      return true;
    } catch (err: any) {
      setJsonEditError(err?.message || 'JSON 解析失败');
      return false;
    }
  };

  const handlePreviewModeChange = (mode: 'preview' | 'markdown') => {
    if (previewMode === 'markdown' && mode === 'preview' && result?.daily_report_json) {
      if (!applyJsonEditText(jsonEditText)) {
        toastError('JSON 无效，请先修正后再切换预览');
        return;
      }
    }
    setPreviewMode(mode);
  };

  // 工作流进度：模块级 store，切页后回到本页仍能显示运行中/已完成状态
  useEffect(() => {
    workflowRunStore.hydrateFromStorage();
    setWfRun(workflowRunStore.getSnapshot());
    const unsub = workflowRunStore.subscribe(() => setWfRun(workflowRunStore.getSnapshot()));
    return unsub;
  }, []);

  // 工作流新跑完一轮时恢复预览（用户手动清除后不再自动写回）
  useEffect(() => {
    if (wfRun.status !== 'done' || !wfRun.resultMarkdown || !wfRun.runId) return;
    if (lastSyncedWorkflowRunId.current === wfRun.runId) return;
    lastSyncedWorkflowRunId.current = wfRun.runId;
    setResult({
      daily_summary_markdown: wfRun.resultMarkdown,
      daily_report_json: wfRun.resultReport ?? wfRun.resultJson
    });
    if (wfRun.editorialPlan) setEditorialPlan(wfRun.editorialPlan);
  }, [
    wfRun.status,
    wfRun.resultMarkdown,
    wfRun.runId,
    wfRun.editorialPlan,
    wfRun.resultJson,
    wfRun.resultReport
  ]);

  useEffect(() => {
    setEditorialPlan(wfRun.editorialPlan ?? null);
  }, [wfRun.editorialPlan]);

  // 初始化同步通道
  useEffect(() => {
    const channel = new BroadcastChannel('generation_sync');
    channelRef.current = channel;

    channel.onmessage = (event) => {
      if (
        event.data &&
        event.data.type === 'update_content' &&
        event.data.date === date &&
        event.data.source !== 'main'
      ) {
        setResult((prev: any) => ({ ...prev, daily_summary_markdown: event.data.content }));
      }
    };

    return () => {
      channel.close();
    };
  }, [date]);

  // 当内容在本页面变化时同步到其他页面
  useEffect(() => {
    if (result && channelRef.current) {
      channelRef.current.postMessage({
        type: 'update_content',
        date,
        content: result.daily_summary_markdown,
        source: 'main'
      });
    }
  }, [result?.daily_summary_markdown, date]);

  // 移除单条素材
  const handleRemoveItem = (idx: number) => {
    if (!selectedItems) return;
    const newItems = [...selectedItems];
    const removedItem = newItems.splice(idx, 1)[0];
    setSelectedItems(newItems.length > 0 ? newItems : null);

    // 同时更新 selectedIds
    if (selectedIds) {
      const newIds = selectedIds.filter(
        (id: string) => id !== (removedItem.id || removedItem.link || removedItem.url)
      );
      setSelectedIds(newIds.length > 0 ? newIds : null);
    }
  };

  // 历史记录状态 (保留5条)
  const [historyState, setHistoryState] = useState<{
    list: any[];
    index: number;
  }>({ list: [], index: -1 });

  // Recent AI selections (persisted in localStorage, max 9 unique)
  type RecentAISelection = { type: 'workflow' | 'agent'; id: string; name: string };
  const RECENT_KEY = 'ai_picker_recent';
  const loadRecent = (): RecentAISelection[] => {
    try {
      return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    } catch {
      return [];
    }
  };
  const saveRecentSelection = (item: RecentAISelection) => {
    const prev = loadRecent().filter((r) => !(r.type === item.type && r.id === item.id));
    const next = [item, ...prev].slice(0, 9);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  };

  // 加载缓存数据
  useEffect(() => {
    clearExpiredCache();

    // 如果没有从路由传递数据，尝试从缓存加载
    if (!initialResult) {
      const cachedResult = loadFromCache(CACHE_KEYS.GENERATION_RESULT, date) as {
        daily_summary_markdown?: string;
        daily_report_json?: unknown;
        editorialPlan?: EditorialPlan;
      } | null;
      if (cachedResult) {
        setResult(cachedResult);
        setEditorialPlan(cachedResult.editorialPlan ?? null);
        setStatus('草稿已生成（从缓存恢复）');
      }
    }

    if (!initialSelectedIds) {
      const cachedSelectedIds = loadFromCache(CACHE_KEYS.GENERATION_SELECTED_IDS, date);
      if (cachedSelectedIds) {
        setSelectedIds(cachedSelectedIds);
      }
    }

    if (!routeSelectedItems) {
      const cachedSelectedItems = loadFromCache(CACHE_KEYS.GENERATION_SELECTED_ITEMS, date);
      if (cachedSelectedItems) {
        setSelectedItems(cachedSelectedItems);
      }
    }
  }, [date]);

  // 保存数据到缓存
  useEffect(() => {
    if (result) {
      saveToCache(CACHE_KEYS.GENERATION_RESULT, result, date);
    }
  }, [result, date]);

  // 历史记录逻辑
  useEffect(() => {
    if (!result) return;

    const timer = setTimeout(() => {
      setHistoryState((prev) => {
        const { list, index } = prev;
        // 只有在内容真正变化且不是由历史导航引起时，才添加新记录
        if (
          list.length > 0 &&
          index >= 0 &&
          list[index]?.daily_summary_markdown === result.daily_summary_markdown
        ) {
          return prev;
        }
        const newList = list.slice(0, index + 1);
        newList.push(JSON.parse(JSON.stringify(result)));
        const finalList = newList.slice(-5);
        return {
          list: finalList,
          index: finalList.length - 1
        };
      });
    }, 500); // 500ms 防抖

    return () => clearTimeout(timer);
  }, [result]);

  const handleUndo = () => {
    const { list, index } = historyState;
    if (index > 0) {
      const nextIndex = index - 1;
      setHistoryState({ ...historyState, index: nextIndex });
      setResult(list[nextIndex]);
    }
  };

  const handleRedo = () => {
    const { list, index } = historyState;
    if (index < list.length - 1) {
      const nextIndex = index + 1;
      setHistoryState({ ...historyState, index: nextIndex });
      setResult(list[nextIndex]);
    }
  };

  useEffect(() => {
    if (selectedIds) {
      saveToCache(CACHE_KEYS.GENERATION_SELECTED_IDS, selectedIds, date);
    }
  }, [selectedIds, date]);

  useEffect(() => {
    if (selectedItems) {
      saveToCache(CACHE_KEYS.GENERATION_SELECTED_ITEMS, selectedItems, date);
    }
  }, [selectedItems, date]);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [settings, metadata] = await Promise.all([
          getSettings(),
          request('/api/plugins/metadata')
        ]);

        if (settings?.IMAGE_PROXY) {
          setImageProxy(settings.IMAGE_PROXY);
        }

        if (metadata && metadata.publishers) {
          const closedPlugins = settings?.CLOSED_PLUGINS || [];
          const filteredPublishers = metadata.publishers.filter(
            (p: any) => !closedPlugins.includes(p.id)
          );
          setPublishers(filteredPublishers);
        }
      } catch (e) {
        devLogger.error('Failed to load initial data:', e);
      }
    };
    loadInitialData();
  }, []);

  const commitTargets =
    publishers.length > 0
      ? publishers.map((p) => ({
          key: p.id,
          label: p.name,
          icon: p.icon || 'publish',
          desc: p.description || `发布到 ${p.name}`
        }))
      : [
          { key: 'github', label: 'GitHub', icon: 'code', desc: '提交到 GitHub 仓库' },
          { key: 'wechat', label: '微信公众号', icon: 'chat', desc: '发布到微信公众号草稿箱' }
        ];

  const openCommitPicker = () => {
    if (!result) {
      toastInfo('没有可提交的内容');
      return;
    }
    if (result.daily_report_json && previewMode === 'markdown') {
      if (!applyJsonEditText(jsonEditText)) {
        toastError('JSON 无效，请先修正后再提交');
        return;
      }
    }
    setShowCommitPicker(true);
  };

  const handleSelectCommitTarget = async (target: string) => {
    setShowCommitPicker(false);

    const plugin = getPublisherPlugin(target);
    if (plugin?.modal) {
      setActivePublisher(target);
    } else {
      await handleCommit(target);
    }
  };

  const handleCommit = async (target: string, options: any = {}) => {
    if (!result) {
      toastInfo('没有可提交的内容');
      return;
    }
    if (result.daily_report_json && previewMode === 'markdown') {
      if (!applyJsonEditText(jsonEditText)) {
        toastError('JSON 无效，请先修正后再提交');
        return;
      }
    }
    setCommitting(true);
    const targetLabel = commitTargets.find((t) => t.key === target)?.label || target;
    setStatus(`正在提交到 ${targetLabel}...`);
    try {
      // 重新读取：applyJsonEditText 可能刚写回
      const latest = result.daily_report_json
        ? (() => {
            try {
              const parsed = JSON.parse(jsonEditText);
              return isValidDailyReportJson(parsed) ? parsed : result.daily_report_json;
            } catch {
              return result.daily_report_json;
            }
          })()
        : null;
      const reportJson = latest ?? (result as any).daily_report_json ?? null;
      const isLocalSite = target === 'local_site';
      if (isLocalSite && !reportJson) {
        toastError('当前结果没有 JSON 版日报，请改用 “AI 资讯日报（JSON）” 工作流再发布到本站');
        setCommitting(false);
        return;
      }
      const markdownPayload = reportJson
        ? JSON.stringify(reportJson, null, 2)
        : result.daily_summary_markdown;
      const payload: any = {
        content: isLocalSite ? JSON.stringify(reportJson) : markdownPayload,
        date: date,
        items: selectedItems,
        editorialPlan: wfRun.editorialPlan ?? editorialPlan ?? undefined,
        coverageNamespace: wfRun.coverageNamespace || 'default',
        ...(isLocalSite ? { report: reportJson } : {}),
        ...options
      };

      const res = await publishContent(target, payload);

      // 特殊处理 RSS 下载
      if (target === 'rss' && res.data?.content && res.data?.format === 'xml') {
        const blob = new Blob([res.data.content], { type: 'application/xml' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = res.data.filename || `rss-${date}.xml`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        setStatus(`已成功生成 RSS 并开始下载 (${date})`);
        toastSuccess(`已成功生成 RSS 并开始下载 (${date})`);
        return;
      }

      setStatus(`已成功提交到 ${targetLabel} (${date})`);
      const coverage = res.data?.coverage;
      if (coverage?.documentId || coverage?.memoryId) {
        const extra =
          coverage.topicCount != null
            ? `；已写入跨日索引（${coverage.topicCount} 主题 / ${coverage.urlCount ?? 0} URL）`
            : '；已写入跨日索引';
        toastSuccess(`已成功提交到 ${targetLabel} (${date})${extra}。可在「知识与记忆」查看。`);
      } else if (res.data?.media_id) {
        toastSuccess(`已成功提交到 ${targetLabel} (${date})\nMedia ID: ${res.data.media_id}`);
      } else {
        toastSuccess(`已成功提交到 ${targetLabel} (${date})`);
      }

      setActivePublisher(null);
    } catch (error: any) {
      devLogger.error('Commit failed:', error);
      const errorMsg = error.response?.data?.error || error.message || '未知错误';
      setStatus(`提交失败: ${errorMsg}`);
      toastError(`提交失败: ${errorMsg}`);
    } finally {
      setCommitting(false);
    }
  };

  const openAIPicker = async () => {
    if (!selectedIds || selectedIds.length === 0) {
      toastInfo('没有选择任何内容，请返回筛选页面');
      return;
    }
    setShowAIPicker(true);
    setAiPickerTab(loadRecent().length > 0 ? 'recent' : 'workflow');
    setAiPickerLoading(true);
    try {
      const [wfs, ags, tls] = await Promise.all([
        agentService.getWorkflows(),
        agentService.getAgents(),
        agentService.getTools()
      ]);
      setWorkflows(wfs || []);
      setAgents(ags || []);
      setTools(tls || []);
    } catch (e) {
      devLogger.error('Failed to load AI resources:', e);
    } finally {
      setAiPickerLoading(false);
    }
  };

  const handleRunTool = async (tool: Tool, input: string | Record<string, any>) => {
    saveRecentSelection({ type: 'tool' as any, id: tool.id, name: tool.name });
    setShowAIPicker(false);
    setGenerating(true);
    setStatus(`正在执行工具 "${tool.name}"...`);
    try {
      let args: any;
      if (typeof input === 'string') {
        // 尝试解析输入为 JSON，如果失败则作为普通字符串包装在主参数中
        try {
          args = JSON.parse(input);
          if (args && typeof args === 'object' && !Array.isArray(args)) {
            args.date = date;
          }
        } catch {
          // 启发式：根据工具参数寻找最合适的参数名
          const props = tool.parameters?.properties || {};
          const required = tool.parameters?.required || [];
          const firstParam = required[0] || Object.keys(props)[0] || 'input';
          args = { [firstParam]: input, date: date };
        }
      } else {
        // 可视化填写的参数
        args = { ...input, date: date };
      }

      const res = await agentService.runTool(tool.id, args);
      if (res.success) {
        if (res.content) {
          setResult({ daily_summary_markdown: res.content });
        } else if (res.data) {
          setResult({
            daily_summary_markdown:
              typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2)
          });
        }
        setStatus(`工具 "${tool.name}" 执行成功`);
      } else {
        throw new Error(res.error || '执行失败');
      }
    } catch (error: any) {
      devLogger.error('Tool run failed:', error);
      setStatus(`工具执行失败: ${error.message}`);
      toastError(`工具执行失败: ${error.message}`);
    } finally {
      setGenerating(false);
      setSelectedTool(null);
    }
  };

  const handleRunWithWorkflow = async (wf: Workflow) => {
    saveRecentSelection({ type: 'workflow', id: wf.id, name: wf.name });
    setShowAIPicker(false);
    setGenerating(true);
    setStatus(`正在通过工作流 "${wf.name}" 生成内容...`);
    try {
      const inputPayload = selectedItems
        ? JSON.stringify(toWorkflowInputItems(selectedItems))
        : JSON.stringify(selectedIds);
      const digestContext = await agentService.getDigestContext(date).catch(() => null);
      const content = await workflowRunStore.runWorkflowStream(
        wf,
        inputPayload,
        date,
        digestContext?.date === date ? digestContext : null
      );
      if (content) {
        if (mountedRef.current) {
          const snapshot = workflowRunStore.getSnapshot();
          setResult({
            daily_summary_markdown: content,
            daily_report_json: snapshot.resultReport ?? snapshot.resultJson
          });
          setStatus(`工作流 "${wf.name}" 生成成功`);
        }
      } else {
        const snap = workflowRunStore.getSnapshot();
        if (snap.status === 'cancelled') {
          if (mountedRef.current) setStatus('已中断生成');
        } else if (mountedRef.current) {
          const msg = snap.errorMessage || '未知错误';
          setStatus(`工作流执行失败: ${msg}`);
          toastError(`工作流执行失败: ${msg}`);
        }
      }
    } catch (error: any) {
      devLogger.error('Workflow run failed:', error);
      if (mountedRef.current) {
        setStatus(`工作流执行失败: ${error.message}`);
        toastError(`工作流执行失败: ${error.message}`);
      }
    } finally {
      if (mountedRef.current) setGenerating(false);
    }
  };

  const handleRunWithAgent = async (agent: Agent) => {
    saveRecentSelection({ type: 'agent', id: agent.id, name: agent.name });
    setShowAIPicker(false);
    setGenerating(true);
    setStatus(`正在通过 Agent "${agent.name}" 生成内容...`);
    try {
      const inputText = selectedItems
        ? JSON.stringify(toWorkflowInputItems(selectedItems))
        : JSON.stringify(selectedIds);
      const res = await agentService.runAgent(agent.id, inputText, date);
      const content =
        res?.content || (typeof res === 'string' ? res : JSON.stringify(res, null, 2));
      setResult({ daily_summary_markdown: content });
      setStatus(`Agent "${agent.name}" 生成成功`);
    } catch (error: any) {
      devLogger.error('Agent run failed:', error);
      setStatus(`Agent 执行失败: ${error.message}`);
      toastError(`Agent 执行失败: ${error.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    const success = await copyToClipboardUtil(text);
    if (success) {
      toastSuccess('已复制到剪贴板');
    } else {
      toastError('复制失败');
    }
  };

  const handleCancelGeneration = () => {
    if (workflowRunStore.cancelRun()) {
      setGenerating(false);
      setStatus('已中断生成');
    }
  };

  const ActiveModal = activePublisher ? getPublisherPlugin(activePublisher)?.modal : null;

  const isWorkflowRunning = wfRun.status === 'running' || wfRun.status === 'stale';
  const canCancelGeneration = isWorkflowRunning;
  const displayFooterLine = wfRun.steps.length > 0 ? wfRun.lineMessage || status : status || '待命';
  const statusDotClass =
    wfRun.status === 'stale'
      ? 'bg-surface-yellow0 animate-pulse'
      : wfRun.status === 'cancelled'
        ? 'bg-text-stone'
        : wfRun.status === 'error' || displayFooterLine.includes('失败')
          ? 'bg-brand-coral'
          : wfRun.status === 'done' || displayFooterLine.includes('成功')
            ? 'bg-brand-teal'
            : wfRun.status === 'running' || generating
              ? 'bg-surface-yellow0 animate-pulse'
              : status.includes('成功')
                ? 'bg-accent-success'
                : status.includes('失败')
                  ? 'bg-brand-coral'
                  : 'bg-ink';

  return (
    <GenerationPageShell
      date={date}
      generating={generating}
      isWorkflowRunning={isWorkflowRunning}
      canCancelGeneration={canCancelGeneration}
      hasSelectedIds={!!(selectedIds?.length || selectedItems?.length)}
      onDateChange={setDate}
      onOpenAiPicker={openAIPicker}
      onCancelGeneration={handleCancelGeneration}
    >
      <EditorialDecisionPanel
        plan={editorialPlan ?? wfRun.editorialPlan}
        priorCoverage={wfRun.priorCoverage}
      />

      <GenerationMobileTabBar activeTab={mobileTab} onChange={setMobileTab} />

      <div className="flex min-h-[min(52vh,28rem)] flex-1 flex-col overflow-hidden rounded-3xl border border-hairline-soft bg-canvas dark:border-white/5 dark:bg-background-dark md:min-h-0 md:flex-row">
        {/* Left: Selected Content */}
        <div
          className={`w-full md:w-80 md:flex flex-col min-h-0 border-b md:border-b-0 md:border-r border-hairline-soft dark:border-white/5 bg-surface-soft dark:bg-surface-darker/50 ${mobileTab === 'source' ? 'flex flex-1' : 'hidden'} md:h-auto shrink-0`}
        >
          <div className="flex items-center justify-between px-4 py-2 h-12 border-b border-hairline-soft dark:border-white/5 bg-surface dark:bg-surface-darker shrink-0">
            <div className="flex items-center gap-2 text-text-slate dark:text-text-secondary">
              <span className="material-symbols-outlined text-[16px]">list_alt</span>
              <span className="text-sm font-mono font-medium uppercase tracking-wider">
                待处理内容 ({selectedItems?.length || 0})
              </span>
            </div>
            {selectedItems && selectedItems.length > 0 && (
              <button
                onClick={() => {
                  copyToClipboard(JSON.stringify(toWorkflowInputItems(selectedItems), null, 2));
                }}
                className="text-text-stone hover:text-ink-deep p-1 rounded hover:bg-hairline dark:hover:bg-surface-dark transition"
                title="复制素材 JSON"
              >
                <span className="material-symbols-outlined text-[14px]">content_copy</span>
              </button>
            )}
          </div>
          <div className="flex-1 overflow-auto p-3 space-y-3 no-scrollbar">
            {selectedItems && selectedItems.length > 0 ? (
              selectedItems.map((item: any, idx: number) => (
                <div
                  key={idx}
                  onClick={() => setPreviewItem(item)}
                  className="bg-canvas dark:bg-surface-dark p-3 rounded-2xl border border-hairline-soft dark:border-white/5 group relative cursor-pointer card-interactive-subtle hover:border-ink/30"
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveItem(idx);
                    }}
                    className="absolute top-1.5 right-1.5 p-1 text-text-stone hover:text-coral-dark hover:bg-coral-light dark:hover:bg-red-950/20 rounded-md opacity-0 group-hover:opacity-100 transition-all z-10"
                    title="移除"
                  >
                    <span className="material-symbols-outlined text-[14px]">close</span>
                  </button>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-surface-lavender text-ink-deep border border-ink/20">
                      {(item.category || 'feed').toUpperCase()}
                    </span>
                    {item.source && (
                      <span className="ml-auto text-[9px] text-text-stone dark:text-text-secondary truncate max-w-[min(40vw,140px)] sm:max-w-none">
                        {item.source}
                      </span>
                    )}
                  </div>
                  <h3 className="text-xs font-semibold text-text-ink dark:text-white mb-0.5 line-clamp-1">
                    {item.metadata?.translated_title || item.title}
                  </h3>
                  <p className="text-[10px] text-text-slate dark:text-text-secondary line-clamp-1">
                    {resolveItemSnippet(item)}
                  </p>
                </div>
              ))
            ) : (
              <div className="h-full flex items-center justify-center text-text-stone italic text-center px-4 text-xs">
                暂无选择内容
              </div>
            )}
          </div>
        </div>

        {/* Right: Markdown Preview */}
        <div
          className={`flex-1 flex-col min-w-0 min-h-0 ${mobileTab === 'preview' ? 'flex' : 'hidden md:flex'}`}
        >
          <div className="shrink-0 border-b border-hairline-soft bg-surface dark:border-white/5 dark:bg-surface-darker">
            {/* 手机：不再重复「生成预览」标题，单行放撤销 / 模式 / 操作 */}
            <div className="flex md:hidden items-center gap-2 px-3 py-2 min-w-0">
              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={historyState.index <= 0}
                  className="p-1.5 rounded-full hover:bg-hairline dark:hover:bg-surface-dark disabled:opacity-30 disabled:cursor-not-allowed"
                  title="撤回"
                >
                  <span className="material-symbols-outlined text-[18px] text-text-slate">
                    undo
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleRedo}
                  disabled={historyState.index >= historyState.list.length - 1}
                  className="p-1.5 rounded-full hover:bg-hairline dark:hover:bg-surface-dark disabled:opacity-30 disabled:cursor-not-allowed"
                  title="重做"
                >
                  <span className="material-symbols-outlined text-[18px] text-text-slate">
                    redo
                  </span>
                </button>
              </div>
              <AnimatedPillTabs
                className="min-w-0 flex-1"
                size="sm"
                layoutId="generation-preview-mode-tabs"
                trackClassName="w-full border-0"
                fullWidth
                aria-label="预览模式"
                tabs={[
                  { id: 'preview', label: '预览' },
                  { id: 'markdown', label: '编辑' }
                ]}
                active={previewMode}
                onChange={(id) => handlePreviewModeChange(id)}
              />
              <div className="flex shrink-0 items-center gap-0.5">
                {result && (
                  <button
                    onClick={() => window.open(`/preview?date=${date}`, '_blank')}
                    className="text-text-stone hover:text-ink-deep p-1.5 rounded-full hover:bg-hairline dark:hover:bg-surface-dark transition shrink-0"
                    title="在新标签页中打开预览与编辑"
                  >
                    <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                  </button>
                )}
                {result && (
                  <button
                    onClick={() =>
                      copyToClipboard(
                        result.daily_report_json
                          ? prettyReportJson(result.daily_report_json)
                          : result.daily_summary_markdown
                      )
                    }
                    className="text-text-stone hover:text-ink-deep p-1.5 rounded-full hover:bg-hairline dark:hover:bg-surface-dark transition shrink-0"
                    title="复制"
                  >
                    <span className="material-symbols-outlined text-[16px]">content_copy</span>
                  </button>
                )}
                {result && (
                  <button
                    onClick={async () => {
                      if (
                        await showConfirm({
                          title: '清除预览',
                          message: '确定要清除当前日期的生成预览内容吗？',
                          confirmLabel: '清除',
                          variant: 'warning',
                          confirmTone: 'danger'
                        })
                      ) {
                        clearGenerationCacheForDate(date);
                        resetGenerationPreview('内容已清除');
                      }
                    }}
                    className="text-text-stone hover:text-coral-dark p-1.5 rounded-full hover:bg-hairline dark:hover:bg-surface-dark transition shrink-0"
                    title="清除"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                )}
              </div>
            </div>

            {/* 桌面：保留完整标题行 */}
            <div className="hidden md:flex flex-wrap items-center justify-between gap-x-2 gap-y-2 px-4 py-2 min-h-12">
              <div className="flex items-center gap-1 text-text-slate dark:text-text-secondary min-w-0">
                <span className="material-symbols-outlined text-[18px] shrink-0">markdown</span>
                <span className="text-sm font-mono font-medium uppercase tracking-wider whitespace-nowrap shrink-0">
                  生成预览
                </span>
                <div className="flex items-center gap-0.5 ml-1 pl-1 border-l border-hairline-soft dark:border-border-dark shrink-0">
                  <button
                    type="button"
                    onClick={handleUndo}
                    disabled={historyState.index <= 0}
                    className="p-1 rounded hover:bg-hairline dark:hover:bg-surface-dark disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="撤回"
                  >
                    <span className="material-symbols-outlined text-[16px]">undo</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRedo}
                    disabled={historyState.index >= historyState.list.length - 1}
                    className="p-1 rounded hover:bg-hairline dark:hover:bg-surface-dark disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="重做"
                  >
                    <span className="material-symbols-outlined text-[16px]">redo</span>
                  </button>
                </div>
                <AnimatedPillTabs
                  className="ml-2 shrink-0"
                  size="sm"
                  layoutId="generation-preview-mode-tabs-desktop"
                  trackClassName="border-0"
                  aria-label="预览模式"
                  tabs={[
                    { id: 'preview', label: '预览' },
                    { id: 'markdown', label: '编辑' }
                  ]}
                  active={previewMode}
                  onChange={(id) => handlePreviewModeChange(id)}
                />
              </div>

              <div className="flex items-center justify-end gap-1.5 shrink-0 ml-auto">
                {result && (
                  <button
                    onClick={() => window.open(`/preview?date=${date}`, '_blank')}
                    className="text-text-stone hover:text-ink-deep p-1 rounded hover:bg-hairline dark:hover:bg-surface-dark transition shrink-0"
                    title="在新标签页中打开预览与编辑"
                  >
                    <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                  </button>
                )}
                {result && (
                  <button
                    onClick={() =>
                      copyToClipboard(
                        result.daily_report_json
                          ? prettyReportJson(result.daily_report_json)
                          : result.daily_summary_markdown
                      )
                    }
                    className="text-text-stone hover:text-ink-deep p-1 rounded hover:bg-hairline dark:hover:bg-surface-dark transition shrink-0"
                    title="复制"
                  >
                    <span className="material-symbols-outlined text-[16px]">content_copy</span>
                  </button>
                )}
                {result && (
                  <button
                    onClick={async () => {
                      if (
                        await showConfirm({
                          title: '清除预览',
                          message: '确定要清除当前日期的生成预览内容吗？',
                          confirmLabel: '清除',
                          variant: 'warning',
                          confirmTone: 'danger'
                        })
                      ) {
                        clearGenerationCacheForDate(date);
                        resetGenerationPreview('内容已清除');
                      }
                    }}
                    className="text-text-stone hover:text-coral-dark p-1 rounded hover:bg-hairline dark:hover:bg-surface-dark transition shrink-0"
                    title="清除"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                )}
              </div>
            </div>
          </div>
          <div
            className={`flex-1 min-w-0 overflow-x-hidden overflow-y-auto no-scrollbar ${previewMode === 'preview' ? 'p-3 sm:p-4 md:p-8 max-w-3xl mx-auto w-full' : 'p-2 sm:p-3 flex flex-col'}`}
          >
            {result ? (
              previewMode === 'preview' ? (
                result.daily_report_json ? (
                  <DailyReportJsonPreview
                    report={result.daily_report_json as DailyReportJson}
                    className="font-sans text-text-charcoal dark:text-text-stone"
                  />
                ) : (
                  <ContentRenderer
                    content={result.daily_summary_markdown}
                    imageProxy={imageProxy}
                    className="font-sans text-text-charcoal dark:text-text-stone"
                  />
                )
              ) : (
                <div className="flex-1 flex flex-col relative">
                  <div className="absolute right-2 top-2 z-10 flex items-center gap-1.5 px-2 py-1 rounded bg-hairline/50 dark:bg-canvas/5 backdrop-blur-sm pointer-events-none">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-teal animate-pulse"></div>
                    <span className="text-[9px] text-text-slate dark:text-text-secondary font-medium uppercase tracking-wider">
                      {result.daily_report_json ? 'JSON 编辑' : '编辑模式'}
                    </span>
                  </div>
                  {result.daily_report_json ? (
                    <>
                      <textarea
                        value={jsonEditText}
                        onChange={(e) => {
                          setJsonEditText(e.target.value);
                          if (jsonEditError) setJsonEditError(null);
                        }}
                        onBlur={() => applyJsonEditText(jsonEditText)}
                        className="flex-1 w-full font-mono text-[11px] text-text-charcoal dark:text-text-stone bg-surface-soft dark:bg-surface-darker/30 p-3 rounded-lg border border-hairline-soft dark:border-white/5 focus:ring-1 focus:ring-ink outline-none resize-none leading-relaxed"
                        spellCheck={false}
                      />
                      {jsonEditError && (
                        <p className="mt-2 shrink-0 text-[11px] text-coral-dark dark:text-rose-300">
                          {jsonEditError}
                        </p>
                      )}
                    </>
                  ) : (
                    <textarea
                      value={result.daily_summary_markdown}
                      onChange={(e) =>
                        setResult({ ...result, daily_summary_markdown: e.target.value })
                      }
                      className="flex-1 w-full font-mono text-[11px] text-text-charcoal dark:text-text-stone bg-surface-soft dark:bg-surface-darker/30 p-3 rounded-lg border border-hairline-soft dark:border-white/5 focus:ring-1 focus:ring-ink outline-none resize-none leading-relaxed"
                      spellCheck={false}
                    />
                  )}
                </div>
              )
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-text-stone text-center">
                <span className="material-symbols-outlined text-3xl mb-2">auto_awesome_mosaic</span>
                <p className="text-sm">
                  {generating || isWorkflowRunning ? 'AI 正在努力生成中...' : '待生成预览内容'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <WorkflowProgressPanel
        wfRun={wfRun}
        committing={committing}
        hasResult={!!result}
        displayFooterLine={displayFooterLine}
        statusDotClass={statusDotClass}
        onClearCache={async () => {
          if (
            await showConfirm({
              title: '清除缓存',
              message: '确定要清除所有缓存吗？这将清除所有日期的缓存数据。',
              confirmLabel: '清除',
              variant: 'warning',
              confirmTone: 'danger'
            })
          ) {
            clearAllCache();
            resetGenerationPreview('待命');
            setSelectedIds(null);
            setSelectedItems(null);
            toastSuccess('已清除所有缓存');
          }
        }}
        onOpenCommitPicker={openCommitPicker}
      />

      {/* Item Preview Modal */}
      {previewItem && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 bg-ink/60 backdrop-blur-sm"
          onClick={() => setPreviewItem(null)}
        >
          <div
            className="bg-canvas dark:bg-surface-dark w-full max-w-2xl rounded-2xl shadow-modal border border-hairline-soft dark:border-border-dark overflow-hidden flex flex-col max-h-[90vh] sm:max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-hairline-soft dark:border-border-dark flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <span className="text-[9px] sm:text-[10px] font-semibold px-1.5 py-0.5 rounded bg-surface-lavender text-ink-deep border border-ink/20 shrink-0">
                  {previewItem.category?.toUpperCase()}
                </span>
                <h3 className="text-sm sm:text-lg font-semibold text-text-ink dark:text-white truncate">
                  {previewItem.metadata?.translated_title || previewItem.title}
                </h3>
              </div>
              <button
                onClick={() => setPreviewItem(null)}
                className="w-8 h-8 sm:w-9 sm:h-9 inline-flex items-center justify-center text-text-stone hover:bg-surface dark:hover:bg-canvas/5 rounded-full transition-all shrink-0 ml-2"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 sm:p-6">
              <div className="space-y-4">
                {previewItem.url && (
                  <div>
                    <h4 className="text-[10px] sm:text-xs font-semibold text-text-stone uppercase tracking-wider mb-1">
                      链接
                    </h4>
                    <a
                      href={previewItem.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-ink-deep hover:underline break-all text-xs sm:text-sm flex items-center gap-1"
                    >
                      {previewItem.url}
                      <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                    </a>
                  </div>
                )}
                {previewItem.author && (
                  <div>
                    <h4 className="text-[10px] sm:text-xs font-semibold text-text-stone uppercase tracking-wider mb-1">
                      作者
                    </h4>
                    <p className="text-xs sm:text-sm text-text-charcoal dark:text-text-stone">
                      {previewItem.author}
                    </p>
                  </div>
                )}
                {previewItem.published_date && (
                  <div>
                    <h4 className="text-[10px] sm:text-xs font-semibold text-text-stone uppercase tracking-wider mb-1">
                      发布日期
                    </h4>
                    <p className="text-xs sm:text-sm text-text-charcoal dark:text-text-stone">
                      {previewItem.published_date}
                    </p>
                  </div>
                )}
                {previewItem.source && (
                  <div>
                    <h4 className="text-[10px] sm:text-xs font-semibold text-text-stone uppercase tracking-wider mb-1">
                      来源
                    </h4>
                    <p className="text-xs sm:text-sm text-text-charcoal dark:text-text-stone">
                      {previewItem.source}
                    </p>
                  </div>
                )}
                {previewItem.metadata?.content_html && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-[10px] sm:text-xs font-semibold text-text-stone uppercase tracking-wider">
                        HTML 内容
                      </h4>
                      <button
                        onClick={() => copyToClipboard(previewItem.metadata.content_html)}
                        className="text-text-stone hover:text-ink-deep p-1 rounded hover:bg-surface dark:hover:bg-canvas/5 transition-colors"
                        title="复制 HTML 内容"
                      >
                        <span className="material-symbols-outlined text-[14px]">content_copy</span>
                      </button>
                    </div>
                    <div className="text-xs sm:text-sm text-text-charcoal dark:text-text-stone bg-surface-soft dark:bg-surface-darker/50 p-3 sm:p-4 rounded-2xl border border-hairline-soft dark:border-white/5 overflow-wrap-anywhere">
                      <ContentRenderer
                        content={previewItem.metadata.content_html}
                        imageProxy={imageProxy}
                      />
                    </div>
                  </div>
                )}
                {previewItem.metadata?.full_content && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-[10px] sm:text-xs font-semibold text-text-stone uppercase tracking-wider">
                        全文内容
                      </h4>
                      <button
                        onClick={() => copyToClipboard(previewItem.metadata.full_content)}
                        className="text-text-stone hover:text-ink-deep p-1 rounded hover:bg-surface dark:hover:bg-canvas/5 transition-colors"
                        title="复制全文内容"
                      >
                        <span className="material-symbols-outlined text-[14px]">content_copy</span>
                      </button>
                    </div>
                    <div className="text-xs sm:text-sm text-text-charcoal dark:text-text-stone bg-surface-soft dark:bg-surface-darker/50 p-3 sm:p-4 rounded-2xl border border-hairline-soft dark:border-white/5 overflow-wrap-anywhere">
                      <ContentRenderer
                        content={previewItem.metadata.full_content}
                        imageProxy={imageProxy}
                      />
                    </div>
                  </div>
                )}
                {previewItem.metadata?.ai_summary && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-[10px] sm:text-xs font-semibold text-text-stone uppercase tracking-wider">
                        AI 总结
                      </h4>
                      <button
                        onClick={() => copyToClipboard(previewItem.metadata.ai_summary)}
                        className="text-text-stone hover:text-ink-deep p-1 rounded hover:bg-surface dark:hover:bg-canvas/5 transition-colors"
                        title="复制 AI 总结"
                      >
                        <span className="material-symbols-outlined text-[14px]">content_copy</span>
                      </button>
                    </div>
                    <div className="text-xs sm:text-sm text-text-charcoal dark:text-text-stone bg-surface-soft dark:bg-surface-darker/50 p-3 sm:p-4 rounded-2xl border border-hairline-soft dark:border-white/5">
                      <ContentRenderer
                        content={previewItem.metadata.ai_summary}
                        imageProxy={imageProxy}
                      />
                    </div>
                  </div>
                )}
                {(() => {
                  const rawDescription = resolveRawDescription(previewItem);
                  if (!rawDescription) return null;
                  return (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-[10px] sm:text-xs font-semibold text-text-stone uppercase tracking-wider">
                          描述
                        </h4>
                        <button
                          onClick={() => copyToClipboard(rawDescription)}
                          className="text-text-stone hover:text-ink-deep p-1 rounded hover:bg-surface dark:hover:bg-canvas/5 transition-colors"
                          title="复制描述"
                        >
                          <span className="material-symbols-outlined text-[14px]">
                            content_copy
                          </span>
                        </button>
                      </div>
                      <div className="text-xs sm:text-sm text-text-charcoal dark:text-text-stone bg-surface-soft dark:bg-surface-darker/50 p-3 sm:p-4 rounded-2xl border border-hairline-soft dark:border-white/5">
                        <ContentRenderer content={rawDescription} imageProxy={imageProxy} />
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-hairline-soft dark:border-border-dark flex justify-end bg-surface-soft/50 dark:bg-surface-darker/30">
              <button
                onClick={() => setPreviewItem(null)}
                className="w-full sm:w-auto px-6 py-2 rounded-2xl text-sm font-semibold bg-ink hover:bg-cyan-400 text-white shadow-card shadow-primary/20 transition-all"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Publisher Modals */}
      {ActiveModal && (
        <ActiveModal
          date={date}
          content={result?.daily_summary_markdown}
          onClose={() => setActivePublisher(null)}
          onSuccess={(data: any) => {
            const plugin = getPublisherPlugin(activePublisher!);
            const targetLabel = plugin?.name || activePublisher;
            setActivePublisher(null);
            setStatus(`已成功提交到 ${targetLabel} (${date})`);
            if (data?.media_id) {
              toastSuccess(`已成功提交到 ${targetLabel} (${date})\nMedia ID: ${data.media_id}`);
            } else {
              toastSuccess(`已成功提交到 ${targetLabel} (${date})`);
            }
          }}
          onError={(err: string) => {
            setStatus(`提交失败: ${err}`);
            toastError(`提交失败: ${err}`);
          }}
        />
      )}

      {/* AI Execution Picker Modal */}
      {showAIPicker && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-ink/60 backdrop-blur-sm"
          onClick={() => setShowAIPicker(false)}
        >
          <div
            className="bg-canvas dark:bg-surface-dark w-full max-w-lg rounded-2xl shadow-modal border border-hairline-soft dark:border-border-dark overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4 border-b border-hairline-soft dark:border-border-dark shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-surface-lavender flex items-center justify-center text-ink-deep">
                    <span className="material-symbols-outlined text-lg sm:text-xl">
                      auto_awesome
                    </span>
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold text-text-ink dark:text-white">
                      选择 AI 执行方式
                    </h3>
                    <p className="text-[10px] sm:text-xs text-text-slate dark:text-text-secondary">
                      选择使用工作流或 Agent 来处理内容
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAIPicker(false)}
                  className="w-8 h-8 sm:w-9 sm:h-9 inline-flex items-center justify-center text-text-stone hover:bg-surface dark:hover:bg-canvas/5 rounded-full transition-all"
                >
                  <span className="material-symbols-outlined text-xl">close</span>
                </button>
              </div>
              {/* Tabs */}
              <AnimatedPillTabs
                className="mt-3 sm:mt-4"
                variant="surface"
                size="sm"
                layoutId="generation-ai-picker-tabs"
                trackClassName="gap-0.5 sm:gap-1 rounded-lg bg-surface dark:bg-surface-darker border-0"
                aria-label="AI 执行方式"
                tabs={[
                  { id: 'recent', label: '最近', icon: 'history' },
                  { id: 'workflow', label: '工作流', icon: 'account_tree' },
                  { id: 'agent', label: 'Agent', icon: 'smart_toy' },
                  { id: 'tool', label: '工具', icon: 'build' }
                ]}
                active={aiPickerTab}
                onChange={(key) => {
                  setAiPickerTab(key);
                  setSelectedTool(null);
                }}
              />
            </div>

            {/* Content */}
            <div className="p-3 sm:p-4 overflow-auto flex-1">
              {aiPickerLoading ? (
                <div className="flex items-center justify-center py-12 text-text-stone">
                  <div className="w-6 h-6 border-2 border-hairline-soft border-t-primary rounded-full animate-spin mr-3"></div>
                  加载中...
                </div>
              ) : aiPickerTab === 'recent' ? (
                (() => {
                  const recents = loadRecent();
                  if (recents.length === 0)
                    return (
                      <div className="text-center py-8 sm:py-12 text-text-stone">
                        <span className="material-symbols-outlined text-3xl mb-2 block">
                          history
                        </span>
                        <p className="text-sm">暂无最近使用记录</p>
                      </div>
                    );
                  const typeConfig = {
                    workflow: { icon: 'account_tree', color: 'emerald', label: '工作流' },
                    agent: { icon: 'smart_toy', color: 'primary', label: 'Agent' },
                    tool: { icon: 'build', color: 'amber', label: '工具' }
                  } as const;
                  const handleRecentClick = (r: any) => {
                    if (r.type === 'workflow') {
                      const wf = workflows.find((w) => w.id === r.id);
                      if (wf) handleRunWithWorkflow(wf);
                      else {
                        toastError(`工作流 "${r.name}" 已不存在`);
                      }
                    } else if (r.type === 'agent') {
                      const ag = agents.find((a) => a.id === r.id);
                      if (ag) handleRunWithAgent(ag);
                      else {
                        toastError(`Agent "${r.name}" 已不存在`);
                      }
                    } else if (r.type === 'tool') {
                      const tl = tools.find((t) => t.id === r.id);
                      if (tl) {
                        setSelectedTool(tl);
                        setAiPickerTab('tool');
                        // 初始化参数
                        const props = tl.parameters?.properties || {};
                        const required = tl.parameters?.required || [];
                        const firstParam = required[0] || Object.keys(props)[0] || 'input';
                        const defaultInput =
                          result?.daily_summary_markdown ||
                          (selectedItems ? JSON.stringify(selectedItems, null, 2) : '');
                        setToolArguments({ [firstParam]: defaultInput });
                      } else {
                        toastError(`工具 "${r.name}" 已不存在`);
                      }
                    }
                  };
                  return (
                    <div className="space-y-2">
                      {recents.map((r, idx) => {
                        const cfg =
                          typeConfig[r.type as keyof typeof typeConfig] || typeConfig.agent;
                        const colorMap: Record<string, string> = {
                          emerald:
                            'bg-teal-light dark:bg-brand-teal/20 text-moss-dark dark:text-emerald-400 hover:border-emerald-400 dark:hover:border-emerald-400 hover:bg-teal-light/50 dark:hover:bg-brand-teal/5',
                          primary:
                            'bg-surface-lavender text-ink-deep hover:border-ink dark:hover:border-ink hover:bg-surface-lavender',
                          amber:
                            'bg-amber-100 dark:bg-surface-yellow0/20 text-yellow-dark dark:text-amber-400 hover:border-amber-400 dark:hover:border-amber-400 hover:bg-surface-yellow/50 dark:hover:bg-surface-yellow0/5'
                        };
                        const iconColors: Record<string, string> = {
                          emerald:
                            'bg-teal-light dark:bg-brand-teal/20 text-moss-dark dark:text-emerald-400',
                          primary: 'bg-surface-lavender text-ink-deep',
                          amber:
                            'bg-amber-100 dark:bg-surface-yellow0/20 text-yellow-dark dark:text-amber-400'
                        };
                        return (
                          <button
                            key={`${r.type}-${r.id}-${idx}`}
                            onClick={() => handleRecentClick(r)}
                            className={`w-full flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl border border-hairline-soft dark:border-border-dark transition-all group text-left ${colorMap[
                              cfg.color
                            ]
                              ?.split(' ')
                              .filter((c) => c.startsWith('hover:'))
                              .join(' ')}`}
                          >
                            <div
                              className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shrink-0 ${iconColors[cfg.color]}`}
                            >
                              <span className="material-symbols-outlined text-lg sm:text-xl">
                                {cfg.icon}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-text-ink dark:text-white text-xs sm:text-sm truncate">
                                {r.name}
                              </div>
                              <div className="text-[10px] text-text-stone mt-0.5">
                                <span
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-semibold ${iconColors[cfg.color]}`}
                                >
                                  <span
                                    className="material-symbols-outlined"
                                    style={{ fontSize: '10px' }}
                                  >
                                    {cfg.icon}
                                  </span>
                                  {cfg.label}
                                </span>
                              </div>
                            </div>
                            <span className="material-symbols-outlined text-text-stone dark:text-white/10 group-hover:text-ink-deep transition-colors text-lg sm:text-xl">
                              play_arrow
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })()
              ) : aiPickerTab === 'workflow' ? (
                workflows.length === 0 ? (
                  <div className="text-center py-12 text-text-stone">
                    <span className="material-symbols-outlined text-3xl mb-2 block">
                      account_tree
                    </span>
                    <p className="text-sm">暂无工作流，请在智能体页面创建</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {workflows.map((wf) => (
                      <button
                        key={wf.id}
                        onClick={() => handleRunWithWorkflow(wf)}
                        className="w-full flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl border border-hairline-soft dark:border-border-dark hover:border-emerald-400 dark:hover:border-emerald-400 hover:bg-teal-light/50 dark:hover:bg-brand-teal/5 transition-all group text-left"
                      >
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-teal-light dark:bg-brand-teal/20 flex items-center justify-center text-moss-dark dark:text-emerald-400 shrink-0">
                          <span className="material-symbols-outlined text-lg sm:text-xl">
                            account_tree
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-text-ink dark:text-white text-xs sm:text-sm group-hover:text-moss-dark dark:group-hover:text-emerald-400 transition-colors truncate">
                            {wf.name}
                          </div>
                          {wf.description && (
                            <div className="text-[10px] sm:text-xs text-text-slate dark:text-text-secondary mt-0.5 truncate">
                              {wf.description}
                            </div>
                          )}
                          <div className="text-[9px] sm:text-[10px] text-text-stone mt-1">
                            {wf.steps?.length || 0} 个步骤
                          </div>
                        </div>
                        <span className="material-symbols-outlined text-text-stone dark:text-white/10 group-hover:text-moss-dark transition-colors text-lg sm:text-xl">
                          play_arrow
                        </span>
                      </button>
                    ))}
                  </div>
                )
              ) : aiPickerTab === 'agent' ? (
                agents.length === 0 ? (
                  <div className="text-center py-12 text-text-stone">
                    <span className="material-symbols-outlined text-3xl mb-2 block">smart_toy</span>
                    <p className="text-sm">暂无 Agent，请在智能体页面创建</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {agents.map((agent) => (
                      <button
                        key={agent.id}
                        onClick={() => handleRunWithAgent(agent)}
                        className="w-full flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl border border-hairline-soft dark:border-border-dark hover:border-ink dark:hover:border-ink hover:bg-surface-lavender transition-all group text-left"
                      >
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-surface-lavender flex items-center justify-center text-ink-deep shrink-0">
                          <span className="material-symbols-outlined text-lg sm:text-xl">
                            smart_toy
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-text-ink dark:text-white text-xs sm:text-sm group-hover:text-ink-deep transition-colors truncate">
                            {agent.name}
                          </div>
                          {agent.description && (
                            <div className="text-[10px] sm:text-xs text-text-slate dark:text-text-secondary mt-0.5 truncate">
                              {agent.description}
                            </div>
                          )}
                          <div className="text-[9px] sm:text-[10px] text-text-stone mt-1 font-mono truncate">
                            {agent.model || '默认模型'}
                          </div>
                        </div>
                        <span className="material-symbols-outlined text-text-stone dark:text-white/10 group-hover:text-ink-deep transition-colors text-lg sm:text-xl">
                          play_arrow
                        </span>
                      </button>
                    ))}
                  </div>
                )
              ) : selectedTool ? (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <button
                    onClick={() => {
                      setSelectedTool(null);
                      setToolArguments({});
                    }}
                    className="flex items-center gap-1 text-[10px] sm:text-xs text-ink-deep hover:underline mb-2"
                  >
                    <span className="material-symbols-outlined text-sm">arrow_back</span>
                    返回工具列表
                  </button>
                  <div className="bg-surface-soft dark:bg-surface-darker p-3 sm:p-4 rounded-2xl border border-hairline-soft dark:border-border-dark">
                    <div className="flex items-center gap-2 sm:gap-3 mb-2">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-100 dark:bg-surface-yellow0/20 flex items-center justify-center text-yellow-dark dark:text-amber-400">
                        <span className="material-symbols-outlined text-base sm:text-lg">
                          build
                        </span>
                      </div>
                      <h4 className="font-semibold text-sm sm:text-base text-text-ink dark:text-white truncate">
                        {selectedTool.name}
                      </h4>
                    </div>
                    <p className="text-[10px] sm:text-xs text-text-slate dark:text-text-secondary">
                      {selectedTool.description}
                    </p>
                  </div>

                  <div className="space-y-4 max-h-[40vh] overflow-y-auto px-1 no-scrollbar">
                    {Object.entries(selectedTool.parameters?.properties || {}).map(
                      ([key, prop]: [string, any]) => {
                        // 排除 date，因为会自动注入
                        if (key === 'date') return null;

                        const isRequired = selectedTool.parameters?.required?.includes(key);
                        const type = prop.type || 'string';

                        return (
                          <div key={key} className="space-y-1.5">
                            <div className="flex justify-between items-center">
                              <label className="text-[10px] font-semibold text-text-stone uppercase tracking-widest ml-1">
                                {prop.title || key}{' '}
                                {isRequired && <span className="text-coral-dark">*</span>}
                              </label>
                              {prop.description && (
                                <span
                                  className="text-[9px] text-text-stone italic max-w-[60%] truncate"
                                  title={prop.description}
                                >
                                  {prop.description}
                                </span>
                              )}
                            </div>

                            {prop.enum ? (
                              <div className="relative">
                                <select
                                  value={toolArguments[key] || ''}
                                  onChange={(e) =>
                                    setToolArguments({ ...toolArguments, [key]: e.target.value })
                                  }
                                  className="w-full appearance-none px-3 py-2 bg-surface-soft dark:bg-surface-dark border border-hairline-soft dark:border-white/5 rounded-2xl text-xs outline-none focus:ring-2 focus:ring-ink/10 transition-all dark:text-white cursor-pointer"
                                >
                                  <option value="">请选择...</option>
                                  {prop.enum.map((v: string) => (
                                    <option key={v} value={v}>
                                      {v}
                                    </option>
                                  ))}
                                </select>
                                <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-text-stone text-sm">
                                  expand_more
                                </span>
                              </div>
                            ) : type === 'array' ? (
                              prop.items?.enum ? (
                                <div className="grid grid-cols-1 gap-1.5 p-2 bg-surface-soft dark:bg-canvas/[0.02] rounded-2xl border border-hairline-soft dark:border-white/5">
                                  {prop.items.enum.map((v: string) => (
                                    <label
                                      key={v}
                                      className="flex items-center gap-2 cursor-pointer hover:bg-surface dark:hover:bg-canvas/5 px-2 py-1.5 rounded transition-all"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={
                                          Array.isArray(toolArguments[key]) &&
                                          toolArguments[key].includes(v)
                                        }
                                        onChange={(e) => {
                                          const current = Array.isArray(toolArguments[key])
                                            ? toolArguments[key]
                                            : [];
                                          const next = e.target.checked
                                            ? [...current, v]
                                            : current.filter((i: string) => i !== v);
                                          setToolArguments({ ...toolArguments, [key]: next });
                                        }}
                                        className="w-3.5 h-3.5 rounded border-hairline-strong text-ink-deep focus:ring-ink"
                                      />
                                      <span className="text-[11px] text-text-charcoal dark:text-text-stone">
                                        {v}
                                      </span>
                                    </label>
                                  ))}
                                </div>
                              ) : (
                                <textarea
                                  value={
                                    Array.isArray(toolArguments[key])
                                      ? toolArguments[key].join('\n')
                                      : toolArguments[key] || ''
                                  }
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const arr = val
                                      .split('\n')
                                      .map((s) => s.trim())
                                      .filter(Boolean);
                                    setToolArguments({ ...toolArguments, [key]: arr });
                                  }}
                                  placeholder="请输入列表项，每行一个"
                                  className="w-full px-3 py-2 bg-surface-soft dark:bg-surface-dark border border-hairline-soft dark:border-white/5 rounded-2xl text-xs outline-none focus:ring-2 focus:ring-ink/10 transition-all dark:text-white min-h-[80px] resize-y font-mono"
                                />
                              )
                            ) : type === 'boolean' ? (
                              <div className="flex items-center gap-3 p-2 bg-surface-soft dark:bg-canvas/[0.02] rounded-2xl border border-hairline-soft dark:border-white/5">
                                <span className="text-[10px] text-text-slate">启用</span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={!!toolArguments[key]}
                                    onChange={(e) =>
                                      setToolArguments({
                                        ...toolArguments,
                                        [key]: e.target.checked
                                      })
                                    }
                                  />
                                  <div className="w-9 h-5 bg-hairline rounded-full peer peer-checked:bg-ink transition-all after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-canvas after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
                                </label>
                              </div>
                            ) : type === 'number' || type === 'integer' ? (
                              <input
                                type="number"
                                value={toolArguments[key] ?? ''}
                                onChange={(e) =>
                                  setToolArguments({
                                    ...toolArguments,
                                    [key]:
                                      e.target.value === '' ? undefined : Number(e.target.value)
                                  })
                                }
                                placeholder={
                                  prop.default !== undefined ? `默认: ${prop.default}` : ''
                                }
                                className="w-full px-3 py-2 bg-surface-soft dark:bg-surface-dark border border-hairline-soft dark:border-white/5 rounded-2xl text-xs outline-none focus:ring-2 focus:ring-ink/10 transition-all dark:text-white"
                              />
                            ) : (
                              <textarea
                                value={toolArguments[key] || ''}
                                onChange={(e) =>
                                  setToolArguments({ ...toolArguments, [key]: e.target.value })
                                }
                                placeholder={
                                  prop.default !== undefined
                                    ? `默认: ${prop.default}`
                                    : '请输入内容...'
                                }
                                className="w-full px-3 py-2 bg-surface-soft dark:bg-surface-dark border border-hairline-soft dark:border-white/5 rounded-2xl text-xs outline-none focus:ring-2 focus:ring-ink/10 transition-all dark:text-white min-h-[60px] resize-y"
                              />
                            )}
                          </div>
                        );
                      }
                    )}
                  </div>

                  <button
                    onClick={() => handleRunTool(selectedTool, toolArguments)}
                    className="w-full py-2.5 sm:py-3 rounded-2xl bg-ink hover:bg-cyan-400 text-white font-semibold shadow-card shadow-primary/20 transition-all flex items-center justify-center gap-2 text-sm sm:text-base"
                  >
                    <span className="material-symbols-outlined text-lg">play_arrow</span>
                    立即执行
                  </button>
                </div>
              ) : tools.length === 0 ? (
                <div className="text-center py-12 text-text-stone">
                  <span className="material-symbols-outlined text-3xl mb-2 block">build</span>
                  <p className="text-sm">暂无可用工具</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {tools.map((tool) => (
                    <button
                      key={tool.id}
                      onClick={() => {
                        setSelectedTool(tool);
                        const props = tool.parameters?.properties || {};
                        const required = tool.parameters?.required || [];
                        const firstParam = required[0] || Object.keys(props)[0] || 'input';
                        const defaultInput =
                          result?.daily_summary_markdown ||
                          (selectedItems
                            ? JSON.stringify(toWorkflowInputItems(selectedItems), null, 2)
                            : '');
                        setToolArguments({ [firstParam]: defaultInput });
                      }}
                      className="w-full flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl border border-hairline-soft dark:border-border-dark hover:border-amber-400 dark:hover:border-amber-400 hover:bg-surface-yellow/50 dark:hover:bg-surface-yellow0/5 transition-all group text-left"
                    >
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-amber-100 dark:bg-surface-yellow0/20 flex items-center justify-center text-yellow-dark dark:text-amber-400 shrink-0">
                        <span className="material-symbols-outlined text-lg sm:text-xl">build</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="font-semibold text-text-ink dark:text-white text-xs sm:text-sm group-hover:text-yellow-dark dark:group-hover:text-amber-400 transition-colors truncate">
                            {tool.name}
                          </div>
                          {(tool as any).isBuiltin ? (
                            <span className="px-1 py-0.5 rounded text-[7px] sm:text-[8px] font-black bg-surface-lavender text-ink-deep uppercase tracking-wider shrink-0">
                              内置
                            </span>
                          ) : (
                            <span className="px-1 py-0.5 rounded text-[7px] sm:text-[8px] font-black bg-amber-100 dark:bg-surface-yellow0/20 text-yellow-dark uppercase tracking-wider shrink-0">
                              自定义
                            </span>
                          )}
                        </div>
                        {tool.description && (
                          <div className="text-[10px] sm:text-xs text-text-slate dark:text-text-secondary mt-0.5 line-clamp-1">
                            {tool.description}
                          </div>
                        )}
                      </div>
                      <span className="material-symbols-outlined text-text-stone dark:text-white/10 group-hover:text-yellow-dark transition-colors text-lg sm:text-xl">
                        arrow_forward
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Commit Media Picker Modal */}
      {showCommitPicker && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm"
          onClick={() => setShowCommitPicker(false)}
        >
          <div
            className="bg-canvas dark:bg-surface-dark w-full max-w-sm rounded-2xl shadow-modal border border-hairline-soft dark:border-border-dark overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sm:p-6">
              <div className="flex items-center gap-3 mb-4 sm:mb-5">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-surface-lavender flex items-center justify-center text-ink-deep">
                  <span className="material-symbols-outlined text-lg sm:text-xl">publish</span>
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-text-ink dark:text-white">
                    选择提交渠道
                  </h3>
                  <p className="text-[10px] sm:text-xs text-text-slate dark:text-text-secondary">
                    选择内容发布的目标平台
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                {commitTargets.map((target) => (
                  <button
                    key={target.key}
                    onClick={() => handleSelectCommitTarget(target.key)}
                    className="w-full flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl border transition-all group text-left border-hairline-soft dark:border-border-dark hover:border-ink hover:bg-surface-lavender dark:hover:bg-surface-lavender"
                  >
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shrink-0 bg-surface-lavender text-ink-deep">
                      <span className="material-symbols-outlined text-lg sm:text-xl">
                        {target.icon}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs sm:text-sm text-text-ink dark:text-white">
                          {target.label}
                        </span>
                      </div>
                      <div className="text-[10px] sm:text-xs text-text-stone dark:text-text-secondary mt-0.5">
                        {target.desc}
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-text-stone dark:text-white/10 group-hover:text-ink-deep transition-colors text-lg sm:text-xl">
                      arrow_forward
                    </span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowCommitPicker(false)}
                className="w-full mt-4 px-4 py-2 rounded-2xl text-xs sm:text-sm font-medium text-text-slate dark:text-text-secondary hover:bg-surface dark:hover:bg-canvas/5 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </GenerationPageShell>
  );
};

export default Generation;
