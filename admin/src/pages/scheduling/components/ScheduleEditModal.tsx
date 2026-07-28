import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { ScheduleTask } from '../../../services/scheduleService';
import type { Workflow } from '../../../services/agentService';
import { CRON_PRESETS } from '../utils/labels';
import { describeCron } from '../utils/cronDescribe';
import { DialogFooter, DialogFooterButtons } from '../../../components/UI/DialogFooter';

interface Props {
  open: boolean;
  draft: Partial<ScheduleTask> | null;
  workflows: Workflow[];
  adapters: string[];
  adapterGroups?: Array<{ id: string; name: string }>;
  onClose: () => void;
  onSubmit: (schedule: ScheduleTask) => Promise<void> | void;
}

type ExecutorKind = 'INGESTION' | 'WORKFLOW';

const ScheduleEditModal: React.FC<Props> = ({
  open,
  draft,
  workflows,
  adapters,
  adapterGroups = [],
  onClose,
  onSubmit
}) => {
  const [current, setCurrent] = useState<Partial<ScheduleTask> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setCurrent(normalizeDraft(draft));
      setError(null);
    }
  }, [open, draft]);

  const selectedWorkflow = useMemo(() => {
    if (!current || current.type !== 'WORKFLOW') return null;
    return workflows.find((w) => w.id === current.targetId) || null;
  }, [current, workflows]);

  if (!open || !current) return null;

  const setField = <K extends keyof ScheduleTask>(key: K, value: ScheduleTask[K]) => {
    setCurrent((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const setExecutor = (kind: ExecutorKind) => {
    setCurrent((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        type: kind,
        targetId: kind === 'INGESTION' ? prev.targetId || 'all' : '',
        inputs: { values: {} }
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current) return;
    setError(null);

    if (!current.name || !current.name.trim()) {
      setError('请填写任务名称');
      return;
    }
    if (!current.cron || !current.cron.trim()) {
      setError('请填写 Cron 表达式');
      return;
    }
    if (current.type === 'WORKFLOW' && !current.targetId) {
      setError('请选择要执行的工作流');
      return;
    }
    if (current.type === 'INGESTION' && !current.targetId) {
      setError('请选择要采集的数据源（或选「全部数据源」）');
      return;
    }

    setSubmitting(true);
    try {
      const payload: ScheduleTask = {
        id: current.id || `task_${Date.now()}`,
        name: current.name!.trim(),
        description: current.description?.trim() || undefined,
        cron: current.cron!.trim(),
        timezone: current.timezone?.trim() || 'Asia/Shanghai',
        type: current.type as ScheduleTask['type'],
        targetId: current.targetId!,
        inputs: current.inputs || { values: {} },
        execution: current.execution,
        enabled: current.enabled ?? true
      };
      await onSubmit(payload);
    } catch (err: any) {
      setError(err?.message || '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-ink/60 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-canvas dark:bg-surface-dark w-full max-w-2xl rounded-2xl shadow-modal flex flex-col max-h-[min(92vh,calc(100dvh-2rem))] min-h-0 my-auto overflow-hidden"
      >
        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1 overflow-hidden">
          <div className="flex-shrink-0 p-5 border-b border-hairline-soft dark:border-white/5 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-text-ink dark:text-white">
                {current.id?.startsWith('task_') && !current.lastRun
                  ? '新建调度任务'
                  : '编辑调度任务'}
              </h3>
              <p className="text-xs text-text-slate mt-0.5">配置触发节律、执行对象及执行策略。</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-text-stone hover:text-text-charcoal dark:hover:text-white"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 space-y-5">
            <SectionCard title="基础信息">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <FieldShell label="任务名称" required>
                  <input
                    required
                    value={current.name || ''}
                    onChange={(e) => setField('name', e.target.value)}
                    placeholder="例：每日全量采集 + 评分"
                    className="w-full p-2 bg-surface-soft dark:bg-surface-darker border border-hairline-soft dark:border-white/10 rounded-lg text-sm"
                  />
                </FieldShell>
                <FieldShell label="启用状态">
                  <label className="flex items-center gap-2 h-9">
                    <input
                      type="checkbox"
                      checked={current.enabled ?? true}
                      onChange={(e) => setField('enabled', e.target.checked)}
                      className="w-4 h-4 text-ink-deep rounded border-hairline-strong"
                    />
                    <span className="text-sm text-text-charcoal dark:text-text-stone">
                      {(current.enabled ?? true) ? '保存后立即启用' : '保存后保持停用'}
                    </span>
                  </label>
                </FieldShell>
              </div>
              <FieldShell label="任务描述（可选）">
                <textarea
                  rows={2}
                  value={current.description || ''}
                  onChange={(e) => setField('description', e.target.value)}
                  placeholder="补充说明任务的业务用途，便于团队协作。"
                  className="w-full p-2 bg-surface-soft dark:bg-surface-darker border border-hairline-soft dark:border-white/10 rounded-lg text-sm"
                />
              </FieldShell>
            </SectionCard>

            <SectionCard title="触发节律">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <FieldShell label="Cron 表达式" required hint={describeCron(current.cron || '')}>
                  <input
                    required
                    value={current.cron || ''}
                    onChange={(e) => setField('cron', e.target.value)}
                    placeholder="0 9 * * *"
                    className="w-full p-2 bg-surface-soft dark:bg-surface-darker border border-hairline-soft dark:border-white/10 rounded-lg text-sm font-mono"
                  />
                </FieldShell>
                <FieldShell label="时区" hint="默认 Asia/Shanghai">
                  <input
                    value={current.timezone || 'Asia/Shanghai'}
                    onChange={(e) => setField('timezone', e.target.value)}
                    className="w-full p-2 bg-surface-soft dark:bg-surface-darker border border-hairline-soft dark:border-white/10 rounded-lg text-sm font-mono"
                  />
                </FieldShell>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {CRON_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setField('cron', preset.value)}
                    className="text-[10px] px-2 py-0.5 rounded-full border border-hairline-soft dark:border-white/10 text-text-slate hover:text-ink-deep hover:border-ink"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="执行对象">
              <div className="grid grid-cols-2 gap-2">
                <ExecutorTab
                  active={current.type === 'INGESTION'}
                  icon="cloud_download"
                  title="数据源采集"
                  description="按计划调用一个数据源适配器"
                  onClick={() => setExecutor('INGESTION')}
                />
                <ExecutorTab
                  active={current.type === 'WORKFLOW'}
                  icon="account_tree"
                  title="工作流编排"
                  description="按计划触发一个工作流（采集 / 评分 / 日报均在此）"
                  onClick={() => setExecutor('WORKFLOW')}
                />
              </div>

              {current.type === 'INGESTION' && (
                <FieldShell label="选择数据源" required>
                  <select
                    required
                    value={current.targetId || ''}
                    onChange={(e) => setField('targetId', e.target.value)}
                    className="w-full p-2 bg-surface-soft dark:bg-surface-darker border border-hairline-soft dark:border-white/10 rounded-lg text-sm"
                  >
                    <option value="">请选择</option>
                    <option value="all">全部数据源（全量采集）</option>
                    {adapterGroups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}（全部订阅）
                      </option>
                    ))}
                    {adapters.map((id) => (
                      <option key={id} value={id}>
                        {id}
                      </option>
                    ))}
                  </select>
                </FieldShell>
              )}

              {current.type === 'WORKFLOW' && (
                <FieldShell label="选择工作流" required hint={selectedWorkflow?.description}>
                  <select
                    required
                    value={current.targetId || ''}
                    onChange={(e) => setField('targetId', e.target.value)}
                    className="w-full p-2 bg-surface-soft dark:bg-surface-darker border border-hairline-soft dark:border-white/10 rounded-lg text-sm"
                  >
                    <option value="">请选择</option>
                    {workflows.map((wf) => (
                      <option key={wf.id} value={wf.id}>
                        {wf.name} ({wf.id})
                      </option>
                    ))}
                  </select>
                </FieldShell>
              )}
            </SectionCard>

            <SectionCard title="执行策略" hint="可选">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <FieldShell label="超时（分钟）" hint="0 或留空代表不限制">
                  <input
                    type="number"
                    min={0}
                    value={
                      current.execution?.timeoutMs
                        ? Math.round(current.execution.timeoutMs / 60000)
                        : ''
                    }
                    onChange={(e) => {
                      const minutes = Number(e.target.value);
                      setField('execution', {
                        ...(current.execution || {}),
                        timeoutMs:
                          Number.isFinite(minutes) && minutes > 0 ? minutes * 60_000 : undefined
                      });
                    }}
                    className="w-full p-2 bg-surface-soft dark:bg-surface-darker border border-hairline-soft dark:border-white/10 rounded-lg text-sm"
                  />
                </FieldShell>
                <FieldShell label="失败策略" hint="管线内多步任务的失败行为">
                  <select
                    value={current.execution?.failurePolicy || 'stop'}
                    onChange={(e) =>
                      setField('execution', {
                        ...(current.execution || {}),
                        failurePolicy: e.target.value as 'stop' | 'continue'
                      })
                    }
                    className="w-full p-2 bg-surface-soft dark:bg-surface-darker border border-hairline-soft dark:border-white/10 rounded-lg text-sm"
                  >
                    <option value="stop">出错后停止</option>
                    <option value="continue">出错后继续</option>
                  </select>
                </FieldShell>
              </div>
            </SectionCard>
          </div>

          <DialogFooter
            error={error}
            hint={error ? undefined : '保存后将立即按 Cron 表达式装载到调度器。'}
          >
            <DialogFooterButtons
              cancelLabel="取消"
              confirmLabel={submitting ? '保存中…' : '保存调度任务'}
              onCancel={onClose}
              confirmType="submit"
              confirmDisabled={submitting}
            />
          </DialogFooter>
        </form>
      </motion.div>
    </div>
  );
};

const SectionCard: React.FC<{ title: string; hint?: string; children: React.ReactNode }> = ({
  title,
  hint,
  children
}) => (
  <section className="rounded-2xl border border-hairline-soft dark:border-white/5 bg-surface-soft/60 dark:bg-canvas/[0.02] p-4 space-y-3">
    <div className="flex items-end justify-between">
      <h4 className="text-sm font-semibold text-text-charcoal dark:text-slate-200">{title}</h4>
      {hint && <span className="text-[10px] text-text-stone">{hint}</span>}
    </div>
    {children}
  </section>
);

const FieldShell: React.FC<{
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}> = ({ label, required, hint, children }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-semibold text-text-charcoal dark:text-text-stone">
      {label}
      {required && <span className="ml-1 text-rose-500">*</span>}
    </label>
    {children}
    {hint && <p className="text-[10px] text-text-stone">{hint}</p>}
  </div>
);

const ExecutorTab: React.FC<{
  active: boolean;
  icon: string;
  title: string;
  description: string;
  onClick: () => void;
}> = ({ active, icon, title, description, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex flex-col items-start text-left p-3 rounded-lg border transition-colors ${
      active
        ? 'bg-surface-lavender border-ink/40 text-text-ink dark:text-white'
        : 'border-hairline-soft dark:border-white/10 hover:border-ink/30 text-text-charcoal dark:text-text-stone'
    }`}
  >
    <div className="flex items-center gap-2">
      <span
        className={`material-symbols-outlined text-base ${active ? 'text-ink-deep' : 'text-text-stone'}`}
      >
        {icon}
      </span>
      <span className="text-sm font-semibold">{title}</span>
    </div>
    <p className="text-[11px] text-text-slate mt-1">{description}</p>
  </button>
);

function normalizeDraft(draft: Partial<ScheduleTask> | null): Partial<ScheduleTask> {
  if (!draft) {
    return {
      id: `task_${Date.now()}`,
      name: '',
      cron: '30 9 * * *',
      timezone: 'Asia/Shanghai',
      type: 'WORKFLOW',
      targetId: '',
      enabled: true,
      inputs: { values: {} }
    };
  }
  return {
    ...draft,
    timezone: draft.timezone || 'Asia/Shanghai',
    inputs: draft.inputs || { values: {} }
  };
}

export default ScheduleEditModal;
