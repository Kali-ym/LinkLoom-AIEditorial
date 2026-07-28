import React from 'react';
import type { Workflow, WorkflowStep } from '../../../services/agentService';
import type { StepTypeDescriptor } from '../../../hooks/useStepCatalog';
import { getNextStepIds } from '../../../utils/workflowGraph';
import { formatJson, parseJsonField } from '../../../utils/jsonField';
import { Section, SHARED_INPUT_CLASS, SHARED_LABEL_CLASS, Chip } from './shared/Section';
import { SchemaForm } from './shared/SchemaForm';

interface Props {
  workflow: Workflow;
  step: WorkflowStep;
  index: number;
  def?: StepTypeDescriptor;
  isInitial: boolean;
  canRemove: boolean;
  onChange: (patch: Partial<WorkflowStep>) => void;
  onRemove: () => void;
  onSetInitial: () => void;
  onJsonError?: (message: string) => void;
}

/**
 * 工作流编辑器右侧的步骤详情面板。
 * 上半：基础（名称 / 类型 / 启用状态）+ 关联（agent/workflow/tool 选择）
 * 中部：配置（用 SchemaForm 按 catalog.configSchema 自动渲染）
 * 下半：流向（多选 nextStepIds）+ 专家 JSON
 */
export const WorkflowStepDetail: React.FC<Props> = ({
  workflow,
  step,
  index,
  def,
  isInitial,
  canRemove,
  onChange,
  onRemove,
  onSetInitial,
  onJsonError
}) => {
  const stepType = step.type || (step.toolId ? 'tool' : step.workflowId ? 'workflow' : 'agent');
  const nextIds = getNextStepIds(step);
  const isClassic = stepType === 'agent' || stepType === 'tool' || stepType === 'workflow';

  return (
    <div className="space-y-3">
      {/* 头部：序号 / 名称 / 类型 / 操作 */}
      <div className="flex items-start gap-3 px-1">
        <span className="w-8 h-8 rounded-2xl bg-surface dark:bg-canvas/10 flex items-center justify-center text-xs font-semibold text-text-slate dark:text-text-stone">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <input
            value={step.displayName || ''}
            onChange={(e) => onChange({ displayName: e.target.value })}
            placeholder={step.id}
            className="w-full px-3 py-1.5 bg-transparent border-b border-transparent hover:border-hairline-soft focus:border-ink text-base font-semibold text-text-ink dark:text-white outline-none transition-colors"
          />
          <div className="mt-0.5 flex items-center gap-2 px-3 text-[11px]">
            <span className="font-mono text-text-stone">{step.id}</span>
            {def && (
              <span className="text-text-slate dark:text-text-stone">
                <span className="material-symbols-outlined text-[12px] align-middle">
                  {def.icon}
                </span>{' '}
                {def.label}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onChange({ enabled: step.enabled === false })}
            className={`px-2 py-1 rounded-lg text-[10px] font-semibold border transition-colors ${
              step.enabled !== false
                ? 'bg-surface-lavender dark:bg-ink/10 text-ink-deep border-blue-200 dark:border-blue-500/20'
                : 'bg-surface dark:bg-canvas/5 text-text-slate border-hairline-soft dark:border-white/10'
            }`}
          >
            {step.enabled !== false ? '已启用' : '已禁用'}
          </button>
          {!isInitial && (
            <button
              type="button"
              onClick={onSetInitial}
              title="设为入口步骤"
              className="w-8 h-8 rounded-lg text-text-stone hover:text-moss-dark hover:bg-teal-light dark:hover:bg-brand-teal/10 inline-flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-[18px]">flag</span>
            </button>
          )}
          {canRemove && (
            <button
              type="button"
              onClick={onRemove}
              title="删除步骤"
              className="w-8 h-8 rounded-lg text-text-stone hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 inline-flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-[18px]">delete</span>
            </button>
          )}
        </div>
      </div>

      {def?.description && (
        <p className="px-1 text-[11px] text-text-slate dark:text-text-stone leading-relaxed">
          {def.description}
        </p>
      )}

      {/* 关联（agent/workflow/tool 引用） */}
      {isClassic && (
        <Section title="关联对象" icon={def?.icon || 'link'} tone={(def?.color as any) || 'slate'}>
          <ReferenceSelector
            stepType={stepType as 'agent' | 'workflow' | 'tool'}
            def={def}
            step={step}
            workflow={workflow}
            onChange={onChange}
          />
          {stepType === 'agent' && (
            <div className="mt-3 flex flex-wrap gap-3 text-[11px]">
              <label className="inline-flex items-center gap-2 text-text-slate dark:text-text-stone">
                <input
                  type="checkbox"
                  checked={step.agentOptions?.noTools === true}
                  onChange={(e) =>
                    onChange({
                      agentOptions: { ...(step.agentOptions || {}), noTools: e.target.checked }
                    })
                  }
                />
                Agent 禁用工具
              </label>
              <label className="inline-flex items-center gap-2 text-text-slate dark:text-text-stone">
                <input
                  type="checkbox"
                  checked={step.agentOptions?.noSkills === true}
                  onChange={(e) =>
                    onChange({
                      agentOptions: { ...(step.agentOptions || {}), noSkills: e.target.checked }
                    })
                  }
                />
                Agent 禁用技能
              </label>
            </div>
          )}
        </Section>
      )}

      {/* 步骤配置：schema-driven 表单 */}
      {def?.configSchema && def.configSchema.fields.length > 0 && (
        <Section title="步骤配置" icon="tune" tone={(def.color as any) || 'slate'}>
          <SchemaForm
            spec={def.configSchema}
            values={(step.config as Record<string, unknown>) || {}}
            onChange={(next) => onChange({ config: next })}
            expressionPresets={[
              { label: '工作流入参', value: '$.input', description: '整个工作流运行时入参对象' },
              { label: '运行日期', value: '$.input.date' },
              { label: '上一步', value: '$.input' },
              { label: '当前 item', value: '$.item' }
            ]}
          />
        </Section>
      )}

      {/* 流向 */}
      <Section
        title="后续步骤"
        description="多选 = 并行；不选 = 该分支结束。"
        icon="arrow_forward"
        tone="sky"
      >
        <div className="flex flex-wrap gap-1.5">
          {workflow.steps
            .filter((s) => s.id !== step.id)
            .map((target) => {
              const selected = nextIds.includes(target.id);
              return (
                <Chip
                  key={target.id}
                  active={selected}
                  onClick={() => {
                    const updated = selected
                      ? nextIds.filter((id) => id !== target.id)
                      : [...nextIds, target.id];
                    onChange({ nextStepIds: updated });
                  }}
                >
                  {target.displayName || target.id}
                </Chip>
              );
            })}
          {workflow.steps.length <= 1 && (
            <span className="text-[10px] text-text-stone py-1">添加更多步骤后可选择后续节点</span>
          )}
        </div>
      </Section>

      {/* 专家 JSON */}
      <Section
        title="专家模式 JSON"
        description="直接编辑底层结构（config / inputTemplate / inputTransform / execution）。"
        icon="code"
        tone="slate"
        collapsible
        defaultCollapsed
      >
        <div className="space-y-3">
          <ExpertJsonField
            label="config（原始 JSON）"
            value={step.config}
            rows={6}
            onChange={(v) => onChange({ config: v as Record<string, unknown> })}
            onJsonError={onJsonError}
          />
          <ExpertJsonField
            label="inputTemplate"
            value={step.inputTemplate}
            rows={4}
            onChange={(v) => onChange({ inputTemplate: v })}
            onJsonError={onJsonError}
          />
          <ExpertJsonField
            label="inputTransform"
            value={step.inputTransform}
            rows={4}
            onChange={(v) => onChange({ inputTransform: v as WorkflowStep['inputTransform'] })}
            onJsonError={onJsonError}
          />
          <ExpertJsonField
            label="execution"
            value={step.execution}
            rows={4}
            onChange={(v) => onChange({ execution: v as WorkflowStep['execution'] })}
            onJsonError={onJsonError}
          />
        </div>
      </Section>
    </div>
  );
};

const ReferenceSelector: React.FC<{
  stepType: 'agent' | 'workflow' | 'tool';
  def?: StepTypeDescriptor;
  step: WorkflowStep;
  workflow: Workflow;
  onChange: (patch: Partial<WorkflowStep>) => void;
}> = ({ stepType, def, step, workflow, onChange }) => {
  const refs = (def?.references || []).filter((r) => {
    if (stepType === 'workflow') return r.id !== workflow.id;
    return true;
  });

  const selectedId =
    stepType === 'agent'
      ? step.agentId || ''
      : stepType === 'workflow'
        ? step.workflowId || ''
        : step.toolId || '';

  const handleChange = (val: string) => {
    if (stepType === 'agent') onChange({ agentId: val });
    else if (stepType === 'workflow') onChange({ workflowId: val });
    else onChange({ toolId: val });
  };

  return (
    <div className="space-y-2">
      <label className={SHARED_LABEL_CLASS}>
        {stepType === 'agent'
          ? '选择智能体'
          : stepType === 'workflow'
            ? '选择子工作流'
            : '选择流程动作'}
      </label>
      <select
        className={SHARED_INPUT_CLASS}
        value={selectedId}
        onChange={(e) => handleChange(e.target.value)}
      >
        <option value="">请选择</option>
        {refs.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      {selectedId && refs.find((r) => r.id === selectedId)?.description && (
        <p className="text-[10px] text-text-stone leading-relaxed">
          {refs.find((r) => r.id === selectedId)?.description}
        </p>
      )}
    </div>
  );
};

const ExpertJsonField: React.FC<{
  label: string;
  value: unknown;
  rows?: number;
  onChange: (v: unknown) => void;
  onJsonError?: (message: string) => void;
}> = ({ label, value, rows = 4, onChange, onJsonError }) => (
  <label className="space-y-1 block">
    <span className={SHARED_LABEL_CLASS}>{label}</span>
    <textarea
      value={formatJson(value)}
      onChange={(e) => onChange(parseJsonField(e.target.value, value, onJsonError))}
      rows={rows}
      spellCheck={false}
      className={`${SHARED_INPUT_CLASS} font-mono`}
    />
  </label>
);
