import { agentService, type Workflow, type WorkflowStep } from '../services/agentService';
import { getWorkflowStepLabel } from '../utils/workflowStepLabel';
import { saveToCache, CACHE_KEYS } from '../utils/cacheUtils';
import type { EditorialPlan } from '../types/dailyEditorial';
import type { PriorCoveragePayload } from '../types/dailyCoverage';
import type { DigestContextPayload } from '../types/digestContext';

export type StepRunStatus = 'pending' | 'running' | 'done' | 'error';

/** 前端与 SSE 断开且长时间无心跳；后台任务可能仍在跑 */
export type WorkflowRunStatus = 'idle' | 'running' | 'done' | 'error' | 'stale' | 'cancelled';

export interface WorkflowRunStepState {
  stepId: string;
  agentId?: string;
  label: string;
  status: StepRunStatus;
  error?: string;
}

export interface WorkflowRunSnapshot {
  runId: string;
  workflowId: string;
  workflowName: string;
  date: string;
  status: WorkflowRunStatus;
  steps: WorkflowRunStepState[];
  lineMessage: string;
  resultMarkdown?: string;
  /** JSON 版工作流（如 wf_ai_daily_report_json）的结构化输出。 */
  resultJson?: unknown;
  /** JSON 版的 report 主体（来自 result.report 字段）。 */
  resultReport?: unknown;
  editorialPlan?: EditorialPlan;
  priorCoverage?: PriorCoveragePayload;
  coverageNamespace?: string;
  errorMessage?: string;
  startedAt: number;
  updatedAt: number;
}

const STORAGE_KEY = 'ai_insight_daily_workflow_run_session_v1';
/** 日报生成单步可能数分钟无事件（批处理重试/拆批），不宜过短误判失败 */
const STALE_RUNNING_MS = 45 * 60 * 1000;

function emptySnapshot(): WorkflowRunSnapshot {
  return {
    runId: '',
    workflowId: '',
    workflowName: '',
    date: '',
    status: 'idle',
    steps: [],
    lineMessage: '',
    startedAt: 0,
    updatedAt: 0
  };
}

let snapshot: WorkflowRunSnapshot = emptySnapshot();
const listeners = new Set<() => void>();
let activeAbort: AbortController | null = null;

function persist() {
  try {
    if (snapshot.status === 'idle' && !snapshot.runId) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    /* ignore */
  }
}

function setSnapshot(next: WorkflowRunSnapshot) {
  snapshot = next;
  persist();
  listeners.forEach((fn) => fn());
}

function buildSteps(
  wf: Workflow,
  agents: { id: string; name: string }[],
  tools: { id: string; name: string; displayName?: string }[] = []
): WorkflowRunStepState[] {
  return (wf.steps || []).map((s: WorkflowStep) => ({
      stepId: s.id,
      agentId: s.agentId,
      label: getWorkflowStepLabel(s, agents, tools),
      status: 'pending' as StepRunStatus
    }));
}

export const workflowRunStore = {
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },

  getSnapshot(): WorkflowRunSnapshot {
    return JSON.parse(JSON.stringify(snapshot)) as WorkflowRunSnapshot;
  },

  /** 清除工作流运行会话（内存 + localStorage） */
  clearSession() {
    snapshot = emptySnapshot();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    listeners.forEach((fn) => fn());
  },

  /** 从 localStorage 恢复；长时间停留在 running 则视为已中断 */
  hydrateFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        if (snapshot.status !== 'idle' || snapshot.runId) {
          snapshot = emptySnapshot();
          listeners.forEach((fn) => fn());
        }
        return;
      }
      const parsed = JSON.parse(raw) as WorkflowRunSnapshot;
      if (parsed.status === 'running' && Date.now() - (parsed.updatedAt || 0) > STALE_RUNNING_MS) {
        parsed.status = 'stale';
        parsed.errorMessage =
          '页面会话已过期，但后台可能仍在执行（请查看终端日志）。勿重复点击生成，除非确认任务已结束。';
        parsed.lineMessage =
          parsed.lineMessage && !parsed.lineMessage.includes('失败')
            ? `${parsed.lineMessage}（会话已断开，后台可能仍在运行）`
            : '会话已断开，后台可能仍在运行';
      }
      snapshot = { ...emptySnapshot(), ...parsed, steps: parsed.steps || [] };
      listeners.forEach((fn) => fn());
    } catch {
      /* ignore */
    }
  },

  resetIdle() {
    activeAbort?.abort();
    activeAbort = null;
    setSnapshot(emptySnapshot());
  },

  /** 中断当前工作流 SSE；后台任务可能仍在执行，需查看服务端日志确认。 */
  cancelRun() {
    const cur = snapshot;
    if (cur.status !== 'running') return false;
    activeAbort?.abort();
    activeAbort = null;
    setSnapshot({
      ...cur,
      status: 'cancelled',
      lineMessage: '已中断生成（后台可能仍在执行）',
      updatedAt: Date.now()
    });
    return true;
  },

  async runWorkflowStream(
    wf: Workflow,
    input: string,
    date: string,
    digestContextInput?: DigestContextPayload | null
  ): Promise<string | null> {
    const runId = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const [agents, tools] = await Promise.all([
      agentService.getAgents(),
      agentService.getTools()
    ]);
    const steps = buildSteps(wf, agents || [], tools || []);

    setSnapshot({
      runId,
      workflowId: wf.id,
      workflowName: wf.name,
      date,
      status: 'running',
      steps,
      coverageNamespace:
        typeof (wf.templateVariables as any)?.coverageNamespace === 'string'
          ? (wf.templateVariables as any).coverageNamespace
          : typeof (wf.metadata as any)?.coverageNamespace === 'string'
            ? (wf.metadata as any).coverageNamespace
            : undefined,
      lineMessage: `正在执行工作流「${wf.name}」…`,
      startedAt: Date.now(),
      updatedAt: Date.now()
    });

    const token = localStorage.getItem('auth_token');
    const url = `/api/workflows/${encodeURIComponent(wf.id)}/run`;

    const digestContext: unknown = digestContextInput ?? undefined;

    activeAbort?.abort();
    const abortController = new AbortController();
    activeAbort = abortController;

    const applyPayload = (data: any, runIdCheck: string) => {
      if (!data || typeof data !== 'object') return;
      const cur = workflowRunStore.getSnapshot();
      if (cur.runId !== runIdCheck) return;

      if (data.type === 'batch') {
        const labels = (data.stepIds || [])
          .map((id: string) => cur.steps.find((step) => step.stepId === id)?.label || id)
          .join(', ');
        setSnapshot({
          ...cur,
          lineMessage: `并行执行：${labels}`,
          updatedAt: Date.now()
        });
        return;
      }
      if (data.type === 'heartbeat') {
        setSnapshot({
          ...cur,
          updatedAt: Date.now()
        });
        return;
      }
      if (data.type === 'step_progress') {
        const label =
          data.displayName ||
          cur.steps.find((step) => step.stepId === data.stepId)?.label ||
          data.stepId;
        const detail = typeof data.message === 'string' ? data.message : '';
        setSnapshot({
          ...cur,
          lineMessage: detail ? `进行中：${label} — ${detail}` : `进行中：${label}`,
          updatedAt: Date.now()
        });
        return;
      }
      if (data.type === 'step_start') {
        const nextSteps = cur.steps.map((s) =>
          s.stepId === data.stepId ? { ...s, status: 'running' as const } : s
        );
        setSnapshot({
          ...cur,
          steps: nextSteps,
          lineMessage: `进行中：${data.displayName || data.agentName || data.agentId || data.stepId}`,
          updatedAt: Date.now()
        });
        return;
      }
      if (data.type === 'step_done') {
        const nextSteps = cur.steps.map((s) =>
          s.stepId === data.stepId
            ? {
                ...s,
                status: (data.success ? 'done' : 'error') as StepRunStatus,
                error: data.success ? undefined : data.error
              }
            : s
        );
        setSnapshot({
          ...cur,
          steps: nextSteps,
          lineMessage: data.success
            ? `已完成：${data.displayName || cur.steps.find((s) => s.stepId === data.stepId)?.label || data.stepId}`
            : `失败：${data.displayName || cur.steps.find((s) => s.stepId === data.stepId)?.label || data.stepId}${data.error ? ` — ${data.error}` : ''}`,
          updatedAt: Date.now()
        });
        return;
      }
      if (data.type === 'editorial_plan' && data.editorialPlan) {
        setSnapshot({
          ...cur,
          editorialPlan: data.editorialPlan as EditorialPlan,
          updatedAt: Date.now()
        });
        return;
      }
      if (data.type === 'prior_coverage' && data.priorCoverage) {
        setSnapshot({
          ...cur,
          priorCoverage: data.priorCoverage as PriorCoveragePayload,
          updatedAt: Date.now()
        });
        return;
      }
      if (data.type === 'result') {
        const content =
          typeof data.content === 'string' ? data.content : JSON.stringify(data.content ?? '');
        const editorialPlan = data.editorialPlan as EditorialPlan | undefined;
        const resultJson =
          data.data && typeof data.data === 'object'
            ? (data.data as unknown)
            : undefined;
        const resultReport =
          data.report && typeof data.report === 'object'
            ? (data.report as unknown)
            : resultJson && typeof resultJson === 'object' && 'report' in (resultJson as Record<string, unknown>)
              ? ((resultJson as Record<string, unknown>).report as unknown)
              : undefined;
        const latest = workflowRunStore.getSnapshot();
        if (latest.runId !== runIdCheck) return;
        saveToCache(
          CACHE_KEYS.GENERATION_RESULT,
          {
            daily_summary_markdown: content,
            daily_report_json: resultReport ?? resultJson,
            editorialPlan
          },
          date
        );
        setSnapshot({
          ...latest,
          status: 'done',
          resultMarkdown: content,
          resultJson,
          resultReport,
          editorialPlan: editorialPlan ?? latest.editorialPlan,
          lineMessage: `工作流「${wf.name}」生成成功`,
          updatedAt: Date.now()
        });
      }
    };

    return new Promise((resolve) => {
      let sawResult = false;

      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        signal: abortController.signal,
        body: JSON.stringify({
          input,
          date,
          stream: true,
          runtimeOptions: {
            digestContext
          }
        })
      })
        .then(async (response) => {
          if (!response.ok) {
            const errText = await response.text().catch(() => '');
            throw new Error(errText || `HTTP ${response.status}`);
          }
          const reader = response.body?.getReader();
          if (!reader) throw new Error('No response body');
          const decoder = new TextDecoder();
          let buffer = '';

          const handleLine = (line: string) => {
            if (!line.startsWith('data: ')) return;
            const payload = line.slice(6).trim();
            if (!payload || payload === '[DONE]') return;
            let data: any;
            try {
              data = JSON.parse(payload);
            } catch {
              return;
            }
            if (data.type === 'error') throw new Error(data.message || '工作流执行失败');
            if (data.type === 'result') sawResult = true;
            applyPayload(data, runId);
          };

          const processText = (text: string) => {
            buffer += text;
            const parts = buffer.split('\n\n');
            buffer = parts.pop() || '';
            for (const block of parts) {
              for (const line of block.split('\n')) {
                try {
                  handleLine(line);
                } catch (e) {
                  if (e instanceof Error) throw e;
                }
              }
            }
          };

          for (;;) {
            const { done, value } = await reader.read();
            if (value) processText(decoder.decode(value, { stream: true }));
            if (done) {
              processText(decoder.decode());
              if (buffer.trim()) {
                for (const line of buffer.split('\n')) {
                  try {
                    handleLine(line);
                  } catch (e) {
                    if (e instanceof Error) throw e;
                  }
                }
              }
              break;
            }
          }
        })
        .then(() => {
          if (abortController.signal.aborted) {
            resolve(null);
            return;
          }
          const cur = workflowRunStore.getSnapshot();
          if (cur.runId !== runId) {
            resolve(null);
            return;
          }
          if (sawResult && cur.resultMarkdown != null) {
            resolve(cur.resultMarkdown);
            return;
          }
          if (cur.status === 'cancelled') {
            resolve(null);
            return;
          }
          setSnapshot({
            ...cur,
            status: 'error',
            errorMessage: '未收到生成结果',
            lineMessage: '未收到生成结果',
            updatedAt: Date.now()
          });
          resolve(null);
        })
        .catch((err: Error) => {
          const cur = workflowRunStore.getSnapshot();
          if (cur.runId !== runId) {
            resolve(null);
            return;
          }
          if (err.name === 'AbortError' || abortController.signal.aborted) {
            if (cur.status !== 'cancelled') {
              setSnapshot({
                ...cur,
                status: 'cancelled',
                lineMessage: '已中断生成（后台可能仍在执行）',
                updatedAt: Date.now()
              });
            }
            resolve(null);
            return;
          }
          setSnapshot({
            ...cur,
            status: 'error',
            errorMessage: err.message,
            lineMessage: `失败：${err.message}`,
            updatedAt: Date.now()
          });
          resolve(null);
        })
        .finally(() => {
          if (activeAbort === abortController) {
            activeAbort = null;
          }
        });
    });
  }
};
