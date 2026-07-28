import React, { useState } from 'react';
import { asNumber, formatPercent, percentFromThreshold } from '../shared/ragStatusLabels.js';
import type { RagPipelineTab } from '../shared/types.js';

const DISMISS_KEY = 'linkloom.rag.hybrid-onboard.dismissed';

type Props = {
  ragConfig: Record<string, unknown>;
  status: any;
  hasActiveEmbedding: boolean;
  onNavigate: (tab: RagPipelineTab) => void;
};

type StepId = 'model' | 'index' | 'verify';

function coverageThresholdMet(coverage: any, ragConfig: Record<string, unknown>): boolean {
  const pct = asNumber(coverage?.indexCoveragePercent);
  const raw = ragConfig.minVectorCoverageForHybrid;
  const threshold =
    typeof raw === 'number' && Number.isFinite(raw) ? (raw <= 1 ? raw * 100 : raw) : 80;
  return pct >= threshold;
}

function scrollToModelSummary() {
  document.getElementById('rag-model-summary')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export const HybridOnboardChecklist: React.FC<Props> = ({
  ragConfig,
  status,
  hasActiveEmbedding,
  onNavigate
}) => {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  const hybridEnabled = ragConfig.hybridEnabled === true;
  const hybridReady = status?.readiness === 'hybrid_ready';
  const modelDone = hasActiveEmbedding;
  const indexDone = coverageThresholdMet(status?.coverage, ragConfig);
  const verifyDone = hybridReady;

  if (!hybridEnabled || hybridReady || dismissed) return null;

  const steps: Array<{
    id: StepId;
    title: string;
    hint: string;
    done: boolean;
  }> = [
    {
      id: 'model',
      title: '配置向量模型',
      hint: '在下方「模型连接」选择并测试向量服务',
      done: modelDone
    },
    {
      id: 'index',
      title: '补建语义索引',
      hint: `入库页补建缺失分块（目标覆盖率 ${percentFromThreshold(ragConfig.minVectorCoverageForHybrid)}）`,
      done: indexDone
    },
    {
      id: 'verify',
      title: '试跑验证',
      hint: '诊断页试一条查询，确认召回结果符合预期',
      done: verifyDone
    }
  ];

  const currentStep = steps.find((s) => !s.done)?.id ?? 'verify';
  const completedCount = steps.filter((s) => s.done).length;
  const coverage = status?.coverage;

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  return (
    <section className="rounded-2xl border border-hairline-soft bg-surface-soft/50 p-4 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-base font-semibold text-text-ink dark:text-white">启用混合检索</h4>
          <p className="mt-1 text-[13px] text-text-charcoal dark:text-text-secondary">
            完成以下 {steps.length} 步即可从全文检索升级到语义召回。进度 {completedCount}/{steps.length}
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="btn-pill-ghost !text-xs !py-1 !px-2 shrink-0"
        >
          稍后自行探索
        </button>
      </div>

      <ol className="mt-4 space-y-3">
        {steps.map((step, index) => {
          const isCurrent = !step.done && step.id === currentStep;
          return (
            <li
              key={step.id}
              className={`flex gap-3 rounded-2xl border px-3 py-2.5 ${
                isCurrent
                  ? 'border-ink/20 bg-canvas dark:border-white/15 dark:bg-surface-dark'
                  : 'border-transparent bg-transparent'
              }`}
            >
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  step.done
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200'
                    : isCurrent
                      ? 'bg-ink text-white dark:bg-white dark:text-ink'
                      : 'bg-surface text-text-stone dark:bg-white/10'
                }`}
                aria-hidden="true"
              >
                {step.done ? '✓' : index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-text-ink dark:text-white">{step.title}</p>
                <p className="mt-0.5 text-[13px] text-text-charcoal dark:text-text-secondary">{step.hint}</p>
                {step.id === 'index' && hasActiveEmbedding && coverage && !indexDone && (
                  <p className="mt-1 text-[12px] text-amber-700 dark:text-amber-200">
                    当前覆盖率 {formatPercent(coverage.indexCoveragePercent)}
                  </p>
                )}
                {isCurrent && (
                  <div className="mt-2">
                    {step.id === 'model' && (
                      <button
                        type="button"
                        onClick={scrollToModelSummary}
                        className="btn-pill-primary !text-xs !py-1.5 !px-3"
                      >
                        前往模型连接
                      </button>
                    )}
                    {step.id === 'index' && (
                      <button
                        type="button"
                        onClick={() => onNavigate('ingest')}
                        className="btn-pill-primary !text-xs !py-1.5 !px-3"
                      >
                        前往入库补建
                      </button>
                    )}
                    {step.id === 'verify' && (
                      <button
                        type="button"
                        onClick={() => onNavigate('diagnose')}
                        className="btn-pill-primary !text-xs !py-1.5 !px-3"
                      >
                        打开诊断试跑
                      </button>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
};
