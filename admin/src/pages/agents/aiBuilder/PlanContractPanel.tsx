import React from 'react';
import { aiBuilderUi } from '../../../copy/aiBuilderUi';
import type { PlanContract } from '../../../services/agentService';

interface PlanContractPanelProps {
  contract?: PlanContract;
  compact?: boolean;
}

function policyLabel(contract: PlanContract) {
  if (contract.resourcePolicy.allowResourceCreation) return '允许新建缺失资源';
  if (contract.resourcePolicy.reusePolicy === 'existingOnly') return '只复用现有资源';
  return '优先复用现有资源';
}

/** 识别 inputSchema 是否为 WorkflowInputSpec（含 fields 数组），给用户更具体的运行时入参提示。 */
function describeInputSchema(schema: unknown): string {
  if (!schema) return '未声明';
  if (typeof schema === 'object' && schema !== null) {
    const fields = (schema as { fields?: unknown }).fields;
    if (Array.isArray(fields)) {
      const valid = fields.filter(
        (field) => field && typeof field === 'object' && typeof (field as any).key === 'string'
      ).length;
      return valid > 0 ? `运行时入参 · ${valid} 个字段` : '运行时入参 · 无有效字段';
    }
    return '运行时入参 · 非 fields 结构';
  }
  return '运行时入参已声明';
}

export const PlanContractPanel: React.FC<PlanContractPanelProps> = ({ contract, compact }) => {
  if (!contract) return null;
  const criteria = compact ? contract.acceptanceCriteria.slice(0, 3) : contract.acceptanceCriteria;
  const fieldRefs = compact ? contract.fieldRefs.slice(0, 4) : contract.fieldRefs;
  return (
    <section className="space-y-3 rounded-2xl border border-hairline-soft bg-canvas p-4 dark:border-white/10 dark:bg-canvas/[0.03]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-text-stone">
            计划契约
          </p>
          <p className="mt-1 text-sm font-semibold text-text-ink dark:text-white">
            {policyLabel(contract)}
          </p>
        </div>
        <span className="rounded-full bg-surface px-2.5 py-1 text-[11px] font-semibold text-text-slate dark:bg-canvas/10 dark:text-text-stone">
          {contract.status === 'locked'
            ? '已锁定'
            : contract.status === 'ready'
              ? '可评审'
              : '草稿'}
        </span>
      </div>
      {contract.status !== 'locked' && !compact && (
        <p className="text-xs text-amber-700 dark:text-amber-200">
          {contract.status === 'draft'
            ? '契约尚未锁定，写库前需生成并通过校验的构建计划。'
            : aiBuilderUi.contractConfirm}
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-2xl bg-surface-soft p-3 text-xs dark:bg-black/20">
          <p className="font-semibold text-text-charcoal dark:text-text-secondary">输入 / 输出</p>
          <p className="mt-1 text-text-slate dark:text-text-stone">
            输入：{describeInputSchema(contract.inputSchema)}
          </p>
          <p className="text-text-slate dark:text-text-stone">
            输出：{contract.outputSchema ? '已声明' : '待确认'}
          </p>
        </div>
        <div className="rounded-2xl bg-surface-soft p-3 text-xs dark:bg-black/20">
          <p className="font-semibold text-text-charcoal dark:text-text-secondary">约束</p>
          <p className="mt-1 text-text-slate dark:text-text-stone">
            {contract.constraints[0] || '暂无额外约束'}
          </p>
        </div>
      </div>
      {criteria.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold text-text-slate dark:text-text-stone">
            验收条件
          </p>
          <div className="space-y-1">
            {criteria.map((item, index) => (
              <p
                key={`${item}_${index}`}
                className="rounded-2xl bg-surface-soft px-3 py-2 text-xs text-text-charcoal dark:bg-black/20 dark:text-text-stone"
              >
                {item}
              </p>
            ))}
          </div>
        </div>
      )}
      {fieldRefs.length > 0 && (
        <details className="overflow-hidden rounded-2xl border border-hairline-soft dark:border-white/10">
          <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-text-slate dark:text-text-stone">
            变量 / 字段引用
          </summary>
          <div className="space-y-1 border-t border-hairline-soft p-2 dark:border-white/10">
            {fieldRefs.map((ref) => (
              <p
                key={ref.id}
                className="rounded-lg bg-surface-soft px-2 py-1.5 font-mono text-[11px] text-text-charcoal dark:bg-black/20 dark:text-text-stone"
              >
                {ref.path}
              </p>
            ))}
          </div>
        </details>
      )}
    </section>
  );
};
