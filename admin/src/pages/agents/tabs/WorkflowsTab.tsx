import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type {
  AiBuilderMention,
  Workflow,
  WorkflowStep,
  WorkflowTemplateSummary
} from '../../../services/agentService';
import { getEntityIdFormatError, isResourceIdTaken } from '../../../utils/entityId';
import { useStepCatalog } from '../../../hooks/useStepCatalog';
import { WorkflowStepRow } from '../workflow/WorkflowStepRow';
import { WorkflowStepDetail } from '../workflow/WorkflowStepDetail';
import { StepTypePicker } from '../workflow/shared/StepTypePicker';
import { TemplateVariablesForm } from '../workflow/TemplateVariablesForm';
import { createAiBuilderMention } from '../aiBuilder/AiBuilderPanel';

type StepCatalog = ReturnType<typeof useStepCatalog>;

/**
 * B5 拆分：把原 AgentsPage 内 `renderWorkflows()` 抽到独立组件。
 * state/handler 仍由父级持有，通过 props 注入（与 SkillsTab 一致）。
 */
export interface WorkflowsTabProps {
  workflows: Workflow[];
  workflowTemplates: WorkflowTemplateSummary[];
  editingWorkflow: Workflow | null;
  editingWorkflowTemplate: WorkflowTemplateSummary | undefined;
  editingWorkflowTemplateVars: Record<string, string> | null;
  showWorkflowTemplates: boolean;
  selectedWorkflowTemplateId: string | null;
  templateVariables: Record<string, string>;
  isInstantiatingTemplate: boolean;
  testingWorkflowId: string | null;
  workflowTestInput: string;
  workflowTestResult: Record<string, string>;
  testDate: string;
  selectedStepId: string | null;
  stepPickerOpen: boolean;
  isSaving: boolean;
  aiProviders: unknown[];
  workflowOriginalIdRef: React.RefObject<string | null>;
  stepCatalog: StepCatalog;
  openAiBuilder: (mention?: AiBuilderMention) => void;
  createEmptyWorkflow: () => Workflow;
  setShowWorkflowTemplates: (v: boolean) => void;
  setSelectedWorkflowTemplateId: (id: string | null) => void;
  setTemplateVariables: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setEditingWorkflow: React.Dispatch<React.SetStateAction<Workflow | null>>;
  setEditingWorkflowTemplateVars: React.Dispatch<
    React.SetStateAction<Record<string, string> | null>
  >;
  setTestingWorkflowId: (id: string | null) => void;
  setWorkflowTestInput: (v: string) => void;
  setWorkflowTestResult: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setTestDate: (v: string) => void;
  setSelectedStepId: (id: string | null) => void;
  setStepPickerOpen: (v: boolean) => void;
  handleImportWorkflowFile: (file: File) => void | Promise<void>;
  handleExportWorkflow: (workflow: Workflow) => void;
  handleDeleteWorkflow: (id: string) => void | Promise<void>;
  openWorkflowEditor: (workflow: Workflow, originalId?: string | null) => void;
  closeWorkflowEditor: () => void;
  handleUseWorkflowTemplate: (templateId: string) => void | Promise<void>;
  handleInstantiateWorkflowTemplate: () => void | Promise<void>;
  patchEditingWorkflowTemplateVar: (id: string, value: string) => void;
  handleSaveWorkflow: (workflow: Workflow) => void | Promise<void>;
  moveWorkflowStep: (idx: number, dir: -1 | 1) => void;
  updateWorkflowStep: (stepIdx: number, patch: Partial<WorkflowStep>) => void;
  removeWorkflowStep: (stepIdx: number) => void;
  addWorkflowStep: (type: string) => void;
  handleRunWorkflow: (id: string, input: string) => void | Promise<void>;
  handleCopy: (text: string) => void | Promise<void>;
  handleImportAsDataSource: (content: string, titlePrefix: string) => void | Promise<void>;
  toastError: (msg: string) => void;
  renderWorkflowGraphPreview: (
    steps: WorkflowStep[],
    initialStepId: string,
    compact?: boolean
  ) => React.ReactNode;
}

export const WorkflowsTab: React.FC<WorkflowsTabProps> = ({
  workflows,
  workflowTemplates,
  editingWorkflow,
  editingWorkflowTemplate,
  editingWorkflowTemplateVars,
  showWorkflowTemplates,
  selectedWorkflowTemplateId,
  templateVariables,
  isInstantiatingTemplate,
  testingWorkflowId,
  workflowTestInput,
  workflowTestResult,
  testDate,
  selectedStepId,
  stepPickerOpen,
  isSaving,
  aiProviders,
  workflowOriginalIdRef,
  stepCatalog,
  openAiBuilder,
  createEmptyWorkflow,
  setShowWorkflowTemplates,
  setSelectedWorkflowTemplateId,
  setTemplateVariables,
  setEditingWorkflow,
  setEditingWorkflowTemplateVars,
  setTestingWorkflowId,
  setWorkflowTestInput,
  setWorkflowTestResult,
  setTestDate,
  setSelectedStepId,
  setStepPickerOpen,
  handleImportWorkflowFile,
  handleExportWorkflow,
  handleDeleteWorkflow,
  openWorkflowEditor,
  closeWorkflowEditor,
  handleUseWorkflowTemplate,
  handleInstantiateWorkflowTemplate,
  patchEditingWorkflowTemplateVar,
  handleSaveWorkflow,
  moveWorkflowStep,
  updateWorkflowStep,
  removeWorkflowStep,
  addWorkflowStep,
  handleRunWorkflow,
  handleCopy,
  handleImportAsDataSource,
  toastError,
  renderWorkflowGraphPreview
}) => {
  const wfIdFmtErr = editingWorkflow ? getEntityIdFormatError(editingWorkflow.id) : null;
  const wfIdTakenErr =
    editingWorkflow &&
    !wfIdFmtErr &&
    isResourceIdTaken(workflows, editingWorkflow.id, workflowOriginalIdRef.current);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-text-ink dark:text-white shrink-0">工作流列表</h3>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => openAiBuilder(createAiBuilderMention('create', 'workflow'))}
            className="flex items-center gap-2 px-4 py-2 bg-ink text-white rounded-2xl hover:bg-charcoal transition-all text-sm font-semibold shadow-card shadow-slate-500/20"
          >
            <span className="material-symbols-outlined">auto_awesome</span>
            AI Builder
          </button>
          <button
            onClick={() => setShowWorkflowTemplates(true)}
            className="flex items-center gap-2 px-4 py-2 bg-ink text-white rounded-2xl hover:bg-charcoal transition-all text-sm font-semibold shadow-card shadow-blue-500/20"
          >
            <span className="material-symbols-outlined">dashboard_customize</span>
            从模板创建
          </button>
          <label className="flex items-center gap-2 px-4 py-2 bg-canvas dark:bg-canvas/5 text-text-charcoal dark:text-text-stone border border-hairline-soft dark:border-white/10 rounded-2xl hover:border-emerald-300 transition-all text-sm font-semibold cursor-pointer">
            <span className="material-symbols-outlined">upload_file</span>
            导入 JSON
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) void handleImportWorkflowFile(file);
              }}
            />
          </label>
          <button
            onClick={() => {
              workflowOriginalIdRef.current = null;
              setEditingWorkflow(createEmptyWorkflow());
              setEditingWorkflowTemplateVars(null);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-ink text-white rounded-2xl hover:bg-charcoal transition-all text-sm font-semibold shadow-card shadow-emerald-500/20"
          >
            <span className="material-symbols-outlined">add</span>
            手动创建
          </button>
        </div>
      </div>

      {workflows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-surface-soft dark:bg-canvas/[0.02] rounded-[40px] border border-dashed border-hairline-soft dark:border-white/5">
          <div className="w-20 h-20 rounded-full bg-teal-light dark:bg-brand-teal/10 flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-4xl text-moss-dark">account_tree</span>
          </div>
          <h3 className="text-xl font-semibold text-text-stone dark:text-text-slate mb-2">
            暂无工作流
          </h3>
          <p className="text-sm text-text-stone/80 dark:text-text-slate/80">
            点击「创建工作流」编排多个 Agent 的自动化任务流
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {workflows.map((wf) => (
            <div
              key={wf.id}
              className="bg-canvas dark:bg-surface-dark rounded-3xl border border-hairline-soft dark:border-white/5 p-6 shadow-subtle hover:shadow-subtle transition-all group"
            >
              <div className="flex justify-between items-start mb-4 gap-3">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="w-12 h-12 shrink-0 rounded-2xl bg-teal-light dark:bg-brand-teal/20 text-moss-dark flex items-center justify-center">
                    <span className="material-symbols-outlined text-3xl leading-none">
                      account_tree
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-semibold text-text-ink dark:text-white truncate">
                      {wf.name || '未命名工作流'}
                    </h4>
                    <p className="text-xs text-text-slate dark:text-text-stone line-clamp-2 break-words">
                      {wf.description || '无描述'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0 flex-wrap">
                  <button
                    onClick={() => {
                      setTestingWorkflowId(wf.id);
                      setWorkflowTestInput('');
                      setWorkflowTestResult((prev) => {
                        const next = { ...prev };
                        delete next[wf.id];
                        return next;
                      });
                    }}
                    className="w-9 h-9 inline-flex items-center justify-center text-text-stone hover:text-moss-dark hover:bg-teal-light dark:hover:bg-brand-teal/10 rounded-full transition-all"
                    title="运行"
                  >
                    <span className="material-symbols-outlined text-xl">play_arrow</span>
                  </button>
                  <button
                    onClick={() => handleExportWorkflow(wf)}
                    className="w-9 h-9 inline-flex items-center justify-center text-text-stone hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-full transition-all"
                    title="导出 JSON"
                  >
                    <span className="material-symbols-outlined text-xl">download</span>
                  </button>
                  <button
                    onClick={() => openWorkflowEditor(wf)}
                    className="w-9 h-9 inline-flex items-center justify-center text-text-stone hover:text-moss-dark hover:bg-teal-light dark:hover:bg-brand-teal/10 rounded-full transition-all"
                  >
                    <span className="material-symbols-outlined text-xl">edit</span>
                  </button>
                  <button
                    onClick={() => handleDeleteWorkflow(wf.id)}
                    className="w-9 h-9 inline-flex items-center justify-center text-text-stone hover:text-coral-dark hover:bg-coral-light dark:hover:bg-brand-coral/10 rounded-full transition-all"
                  >
                    <span className="material-symbols-outlined text-xl">delete</span>
                  </button>
                </div>
              </div>

              {/* Step DAG preview */}
              <div className="rounded-2xl border border-hairline-soft/90 dark:border-white/10 bg-gradient-to-b from-slate-50/90 to-slate-100/60 dark:from-white/[0.03] dark:to-white/[0.01] p-2 shadow-inner min-h-[120px]">
                <div className="w-full overflow-x-auto overflow-y-hidden py-2">
                  {renderWorkflowGraphPreview(wf.steps || [], wf.initialStepId, true)}
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <span className="px-2 py-0.5 bg-teal-light dark:bg-brand-teal/10 text-moss-dark dark:text-moss-dark rounded-lg text-[10px] font-semibold">
                  {wf.steps?.length || 0} 个步骤
                </span>
                <span className="text-[10px] text-text-stone font-mono">ID: {wf.id}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showWorkflowTemplates && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4 md:p-6">
            <motion.div
              initial={{ scale: 0.98, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.98, opacity: 0, y: 12 }}
              className="flex max-h-[min(92dvh,100%)] w-full flex-col overflow-hidden rounded-t-[28px] bg-canvas shadow-modal dark:bg-surface-dark sm:max-h-[min(90vh,920px)] sm:max-w-3xl sm:rounded-[28px]"
            >
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-hairline-soft p-4 dark:border-white/5 sm:p-6">
                <div className="min-w-0 pr-2">
                  <h3 className="text-lg font-semibold dark:text-white">
                    {selectedWorkflowTemplateId ? '配置模板参数' : '选择工作流模板'}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-text-slate dark:text-text-stone">
                    模板会生成一套可编辑工作流，保存前不会覆盖现有配置。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowWorkflowTemplates(false)}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-stone transition-all hover:bg-surface dark:hover:bg-canvas/5"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-4 sm:p-6">
                {selectedWorkflowTemplateId ? (
                  <div className="min-w-0 space-y-4">
                    <button
                      type="button"
                      onClick={() => setSelectedWorkflowTemplateId(null)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-text-slate hover:text-ink-deep"
                    >
                      <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                      返回模板列表
                    </button>
                    <TemplateVariablesForm
                      variables={
                        workflowTemplates.find((t) => t.id === selectedWorkflowTemplateId)
                          ?.variables || []
                      }
                      values={templateVariables}
                      aiProviders={aiProviders}
                      onChange={(id, value) =>
                        setTemplateVariables((prev) => ({ ...prev, [id]: value }))
                      }
                    />
                  </div>
                ) : (
                  <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
                    {workflowTemplates.length === 0 ? (
                      <div className="col-span-full rounded-2xl border border-dashed border-hairline-soft p-8 text-center text-sm text-text-stone dark:border-white/10">
                        暂无可用模板
                      </div>
                    ) : (
                      workflowTemplates.map((tpl) => (
                        <button
                          key={tpl.id}
                          type="button"
                          onClick={() => void handleUseWorkflowTemplate(tpl.id)}
                          className="min-w-0 text-left rounded-2xl border border-hairline-soft bg-surface-soft p-4 transition-all hover:border-ink/30 dark:border-white/10 dark:bg-canvas/[0.03] dark:hover:border-blue-500"
                        >
                          <div className="mb-2 flex min-w-0 items-start justify-between gap-2">
                            <h4 className="min-w-0 font-semibold text-text-ink dark:text-white">
                              {tpl.name}
                            </h4>
                            <span className="shrink-0 rounded-lg bg-surface-lavender px-2 py-0.5 text-[10px] font-semibold text-ink-deep dark:bg-ink/20 dark:text-blue-300">
                              {tpl.category || 'template'}
                            </span>
                          </div>
                          <p className="line-clamp-3 text-xs text-text-slate dark:text-text-stone">
                            {tpl.description}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-text-stone">
                            <span>{tpl.workflowCount || 0} 个工作流</span>
                            <span>{tpl.agentCount || 0} 个智能体</span>
                            <span>{tpl.requiredTools?.length || 0} 个工具</span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {selectedWorkflowTemplateId ? (
                <div className="shrink-0 border-t border-hairline-soft p-4 dark:border-white/5 sm:p-6">
                  <button
                    type="button"
                    onClick={() => void handleInstantiateWorkflowTemplate()}
                    disabled={isInstantiatingTemplate}
                    className="w-full rounded-2xl bg-ink py-3 font-semibold text-white transition-all hover:bg-charcoal disabled:opacity-60"
                  >
                    {isInstantiatingTemplate ? '创建中...' : '创建智能体和工作流'}
                  </button>
                </div>
              ) : null}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Workflow Editing Modal */}
      <AnimatePresence>
        {editingWorkflow && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4 md:p-6">
            <motion.div
              initial={{ scale: 0.98, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.98, opacity: 0, y: 12 }}
              className="flex max-h-[min(92dvh,100%)] w-full flex-col overflow-hidden rounded-t-3xl bg-canvas shadow-modal dark:bg-surface-dark sm:max-h-[90vh] sm:max-w-3xl sm:rounded-3xl"
            >
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-hairline-soft p-4 dark:border-white/5 sm:p-6">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-teal-light dark:bg-brand-teal/20 text-moss-dark flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-2xl">account_tree</span>
                  </div>
                  <h3 className="text-xl font-semibold dark:text-white truncate">编排工作流</h3>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <button
                    onClick={() =>
                      openAiBuilder(
                        workflowOriginalIdRef.current
                          ? createAiBuilderMention('workflow', editingWorkflow)
                          : createAiBuilderMention('create', 'workflow')
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-surface-lavender dark:bg-purple-500/10 text-ink-deep dark:text-violet-300 text-xs font-semibold hover:bg-surface-lavender dark:hover:bg-purple-500/20 transition-all"
                  >
                    <span className="material-symbols-outlined text-sm">auto_awesome</span>
                    AI Builder
                  </button>
                  <button
                    onClick={closeWorkflowEditor}
                    className="w-9 h-9 inline-flex items-center justify-center text-text-stone hover:bg-surface dark:hover:bg-canvas/5 rounded-full transition-all"
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-4 no-scrollbar sm:p-6 md:p-8">
                <div className="min-w-0 space-y-6">
                  {editingWorkflowTemplateVars && editingWorkflowTemplate?.variables?.length ? (
                    <details className="overflow-hidden rounded-2xl border border-hairline-soft bg-surface-soft/50 dark:border-white/10 dark:bg-canvas/[0.02]">
                      <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-text-charcoal dark:text-text-secondary">
                        模板参数
                      </summary>
                      <div className="space-y-3 border-t border-hairline-soft p-4 dark:border-white/10">
                        <TemplateVariablesForm
                          variables={editingWorkflowTemplate.variables}
                          values={editingWorkflowTemplateVars}
                          aiProviders={aiProviders}
                          onChange={patchEditingWorkflowTemplateVar}
                        />
                        {(wfIdFmtErr || wfIdTakenErr) && (
                          <p className="text-xs text-coral-dark dark:text-red-400 font-medium">
                            {wfIdFmtErr || '该 ID 已被使用'}
                          </p>
                        )}
                      </div>
                    </details>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-semibold text-text-stone uppercase tracking-widest ml-1">
                            名称
                          </label>
                          <input
                            type="text"
                            value={editingWorkflow.name}
                            onChange={(e) =>
                              setEditingWorkflow({ ...editingWorkflow, name: e.target.value })
                            }
                            placeholder="例如: 每日资讯摘要"
                            className="w-full px-4 py-2.5 bg-surface-soft dark:bg-surface-dark border border-hairline-soft dark:border-white/5 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-ink/10 transition-all dark:text-white"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-semibold text-text-stone uppercase tracking-widest ml-1">
                            ID
                          </label>
                          <input
                            type="text"
                            value={editingWorkflow.id}
                            onChange={(e) =>
                              setEditingWorkflow({ ...editingWorkflow, id: e.target.value })
                            }
                            placeholder="例如 daily_digest"
                            spellCheck={false}
                            className={`w-full px-4 py-2.5 bg-surface-soft dark:bg-surface-dark border rounded-2xl text-sm font-mono outline-none focus:ring-2 transition-all dark:text-white ${
                              wfIdFmtErr || wfIdTakenErr
                                ? 'border-red-300 dark:border-red-500/40 focus:ring-red-500/20'
                                : 'border-hairline-soft dark:border-white/5 focus:ring-ink/10'
                            }`}
                          />
                          <p className="text-[10px] text-text-stone dark:text-text-slate leading-relaxed ml-1">
                            新建时预填 ID；修改 ID 保存后将删除旧 ID 记录（需确认）。
                          </p>
                          {wfIdFmtErr && (
                            <p className="text-xs text-coral-dark dark:text-red-400 font-medium ml-1">
                              {wfIdFmtErr}
                            </p>
                          )}
                          {!wfIdFmtErr && wfIdTakenErr && (
                            <p className="text-xs text-coral-dark dark:text-red-400 font-medium ml-1">
                              该 ID 已被使用
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-semibold text-text-stone uppercase tracking-widest ml-1">
                          描述
                        </label>
                        <input
                          type="text"
                          value={editingWorkflow.description}
                          onChange={(e) =>
                            setEditingWorkflow({ ...editingWorkflow, description: e.target.value })
                          }
                          placeholder="简短描述此工作流的用途..."
                          className="w-full px-4 py-2.5 bg-surface-soft dark:bg-surface-dark border border-hairline-soft dark:border-white/5 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-ink/10 transition-all dark:text-white"
                        />
                      </div>
                    </>
                  )}

                  {/* DAG Mini Preview */}
                  <div className="p-4 bg-surface-soft/50 dark:bg-canvas/[0.02] rounded-2xl border border-hairline-soft dark:border-white/5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm text-text-slate">
                          account_tree
                        </span>
                        <span className="text-[10px] font-semibold text-text-slate uppercase tracking-widest">
                          执行流程预览
                        </span>
                      </div>
                    </div>
                    <div className="w-full overflow-x-auto overflow-y-hidden pb-2">
                      {renderWorkflowGraphPreview(
                        editingWorkflow.steps,
                        editingWorkflow.initialStepId
                      )}
                    </div>
                  </div>

                  {/* Steps Editor: left list + right detail */}
                  <div className="grid grid-cols-12 gap-4">
                    <aside className="col-span-12 md:col-span-5 lg:col-span-4 min-w-0">
                      <div className="rounded-2xl border border-hairline-soft dark:border-white/5 bg-canvas dark:bg-canvas/[0.02] overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-2 border-b border-hairline-soft dark:border-white/5">
                          <span className="text-[10px] font-semibold text-text-slate uppercase tracking-widest">
                            步骤
                          </span>
                          <button
                            type="button"
                            onClick={() => setStepPickerOpen(true)}
                            className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-ink-deep hover:bg-surface-lavender rounded-lg px-2 py-1"
                          >
                            <span className="material-symbols-outlined text-sm">add</span>
                            添加
                          </button>
                        </div>
                        <div className="p-2 space-y-1 max-h-[55vh] overflow-y-auto">
                          {editingWorkflow.steps.map((step, idx) => (
                            <WorkflowStepRow
                              key={step.id}
                              step={step}
                              index={idx}
                              active={selectedStepId === step.id}
                              isInitial={step.id === editingWorkflow.initialStepId}
                              def={stepCatalog.getDef(step.type)}
                              onSelect={() => setSelectedStepId(step.id)}
                              onMoveUp={idx > 0 ? () => moveWorkflowStep(idx, -1) : undefined}
                              onMoveDown={
                                idx < editingWorkflow.steps.length - 1
                                  ? () => moveWorkflowStep(idx, 1)
                                  : undefined
                              }
                            />
                          ))}
                          {editingWorkflow.steps.length === 0 && (
                            <div className="text-center text-[11px] text-text-stone py-6">
                              还没有步骤，点击「添加」开始编排。
                            </div>
                          )}
                        </div>
                      </div>
                    </aside>

                    <main className="col-span-12 md:col-span-7 lg:col-span-8 min-w-0">
                      {(() => {
                        const selectedIdx = editingWorkflow.steps.findIndex(
                          (s) => s.id === selectedStepId
                        );
                        const effectiveIdx =
                          selectedIdx >= 0
                            ? selectedIdx
                            : editingWorkflow.steps.length > 0
                              ? 0
                              : -1;
                        if (effectiveIdx < 0) {
                          return (
                            <div className="rounded-2xl border border-dashed border-hairline-soft dark:border-white/10 p-8 text-center text-sm text-text-stone">
                              添加一个步骤开始编辑
                            </div>
                          );
                        }
                        const step = editingWorkflow.steps[effectiveIdx];
                        return (
                          <WorkflowStepDetail
                            workflow={editingWorkflow}
                            step={step}
                            index={effectiveIdx}
                            def={stepCatalog.getDef(step.type)}
                            isInitial={step.id === editingWorkflow.initialStepId}
                            canRemove={editingWorkflow.steps.length > 1}
                            onChange={(patch) => updateWorkflowStep(effectiveIdx, patch)}
                            onRemove={() => {
                              removeWorkflowStep(effectiveIdx);
                              setSelectedStepId(null);
                            }}
                            onSetInitial={() =>
                              setEditingWorkflow({ ...editingWorkflow, initialStepId: step.id })
                            }
                            onJsonError={toastError}
                          />
                        );
                      })()}
                    </main>
                  </div>

                  {stepPickerOpen && (
                    <StepTypePicker
                      stepTypes={stepCatalog.stepTypes}
                      onClose={() => setStepPickerOpen(false)}
                      onPick={(type) => {
                        addWorkflowStep(type);
                        setStepPickerOpen(false);
                      }}
                    />
                  )}
                </div>
              </div>

              <div className="flex shrink-0 flex-col gap-2 border-t border-hairline-soft p-4 dark:border-white/5 sm:flex-row sm:p-6">
                <button
                  type="button"
                  onClick={() => handleSaveWorkflow(editingWorkflow)}
                  disabled={
                    isSaving || !editingWorkflow.name.trim() || !!wfIdFmtErr || !!wfIdTakenErr
                  }
                  className="flex-1 rounded-2xl bg-ink py-3 font-semibold text-white shadow-card transition-all hover:bg-charcoal disabled:opacity-50"
                >
                  {isSaving ? '保存中...' : '确认保存'}
                </button>
                <button
                  type="button"
                  onClick={closeWorkflowEditor}
                  className="flex-1 rounded-2xl bg-surface py-3 font-semibold text-text-charcoal transition-all hover:bg-hairline dark:bg-canvas/5 dark:text-white dark:hover:bg-canvas/10"
                >
                  取消
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Workflow Test Modal */}
      <AnimatePresence>
        {testingWorkflowId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-canvas dark:bg-surface-dark rounded-3xl shadow-modal w-full max-w-lg p-4 sm:p-6 md:p-8"
            >
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-teal-light dark:bg-brand-teal/20 text-moss-dark flex items-center justify-center">
                    <span className="material-symbols-outlined text-2xl">play_arrow</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold dark:text-white">运行工作流</h3>
                    <p className="text-xs text-text-stone">
                      {workflows.find((w) => w.id === testingWorkflowId)?.name}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setTestingWorkflowId(null)}
                  className="w-9 h-9 inline-flex items-center justify-center text-text-stone hover:bg-surface dark:hover:bg-canvas/5 rounded-full transition-all"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-1 space-y-1.5">
                    <label className="text-[10px] font-semibold text-text-stone uppercase tracking-widest ml-1">
                      处理日期
                    </label>
                    <input
                      type="date"
                      value={testDate}
                      onChange={(e) => setTestDate(e.target.value)}
                      className="w-full px-4 py-2 bg-surface-soft dark:bg-surface-dark border border-hairline-soft dark:border-white/5 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-ink/10 transition-all dark:text-white"
                    />
                  </div>
                </div>
                <textarea
                  rows={3}
                  value={workflowTestInput}
                  onChange={(e) => setWorkflowTestInput(e.target.value)}
                  placeholder="输入初始数据（文本或 JSON）..."
                  className="w-full px-4 py-3 bg-surface-soft dark:bg-surface-dark border border-hairline-soft dark:border-white/5 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-ink/10 transition-all dark:text-white resize-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      handleRunWorkflow(testingWorkflowId, workflowTestInput);
                    }
                  }}
                />
                <button
                  onClick={() => handleRunWorkflow(testingWorkflowId, workflowTestInput)}
                  disabled={
                    !workflowTestInput.trim() ||
                    workflowTestResult[testingWorkflowId] === '正在思考...'
                  }
                  className="w-full py-3 bg-ink text-white rounded-2xl font-semibold hover:bg-charcoal transition-all shadow-card shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-xl">
                    {workflowTestResult[testingWorkflowId] === '正在思考...'
                      ? 'hourglass_top'
                      : 'send'}
                  </span>
                  {workflowTestResult[testingWorkflowId] === '正在思考...'
                    ? '正在思考...'
                    : '执行工作流'}
                </button>

                {workflowTestResult[testingWorkflowId] && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center px-1">
                      <label className="text-[10px] font-semibold text-text-stone uppercase tracking-widest">
                        执行结果
                      </label>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleCopy(workflowTestResult[testingWorkflowId])}
                          className="flex items-center gap-1 text-[10px] font-semibold text-moss-dark hover:text-moss-dark transition-colors"
                        >
                          <span className="material-symbols-outlined text-sm">content_copy</span>
                          复制
                        </button>
                        <button
                          onClick={() =>
                            handleImportAsDataSource(
                              workflowTestResult[testingWorkflowId],
                              `工作流运行: ${workflows.find((w) => w.id === testingWorkflowId)?.name}`
                            )
                          }
                          className="flex items-center gap-1 text-[10px] font-semibold text-ink-deep hover:text-ink-deep transition-colors"
                        >
                          <span className="material-symbols-outlined text-sm">input</span>
                          导入为数据源
                        </button>
                      </div>
                    </div>
                    <div className="w-full p-4 bg-surface-soft dark:bg-black/20 rounded-2xl text-xs text-text-charcoal dark:text-text-stone font-mono whitespace-pre-wrap break-words max-h-60 overflow-y-auto border border-hairline-soft dark:border-white/5">
                      {workflowTestResult[testingWorkflowId]}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
