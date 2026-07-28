import React from 'react';
import type { RagIndexVersion } from '../../../../../services/ragService';
import {
  CHUNK_EMBEDDING_FIELDS,
  CHUNK_FIXED_FIELDS,
  CHUNK_STRUCTURE_FIELDS
} from '../shared/ragFieldMeta.js';
import {
  numberValue,
  TARGET_STORAGE_OPTIONS,
  targetStorageLabel,
  type ReindexTarget
} from '../shared/ragStatusLabels.js';
import { NumberField, opsHintClass, opsInputClass, opsSelectClass, SectionCard, StatusChip } from '../shared/ragUi.js';
import type { ReindexOptions } from '../shared/types.js';
import { OpsLabelWithHint } from '../../../opsUiPrimitives';
import { OPS_METRIC_HINTS } from '../../../opsMetricHints';

type Props = {
  ragConfig: Record<string, unknown>;
  hasActiveEmbedding: boolean;
  reindexOptions: ReindexOptions;
  indexVersions: RagIndexVersion[];
  busy: string | null;
  onPatch: (patch: Record<string, unknown>) => void;
  onReindexOptionsChange: (patch: Partial<ReindexOptions>) => void;
  onEnqueueReindex: () => void;
  onBindVersionNavigate?: (version: string) => void;
};

function chunkStrategyValue(ragConfig: Record<string, unknown>): 'fixed' | 'structure' | 'embedding' {
  const value = ragConfig.chunkStrategy;
  if (value === 'embedding' || value === 'structure') return value;
  return 'fixed';
}

export const IngestAdvancedPanel: React.FC<Props> = ({
  ragConfig,
  hasActiveEmbedding,
  reindexOptions,
  indexVersions,
  busy,
  onPatch,
  onReindexOptionsChange,
  onEnqueueReindex,
  onBindVersionNavigate
}) => {
  const strategy = chunkStrategyValue(ragConfig);
  const chunkFields =
    strategy === 'embedding'
      ? CHUNK_EMBEDDING_FIELDS
      : strategy === 'structure'
        ? CHUNK_STRUCTURE_FIELDS
        : CHUNK_FIXED_FIELDS;

  const candidateVersions = indexVersions.filter((v) =>
    ['candidate', 'building'].includes(v.status || '')
  );

  return (
    <details className="rounded-2xl border border-hairline-soft bg-canvas dark:border-white/10 dark:bg-surface-dark">
      <summary className="cursor-pointer select-none px-4 py-3 text-base font-semibold text-text-ink dark:text-white">
        高级索引
      </summary>
      <div className="space-y-4 border-t border-hairline-soft px-4 py-4 dark:border-white/10">
        <SectionCard title="分块策略" subtitle="变更后新文档生效，已有文档需 reindex 重建索引。">
          <label className="space-y-1 text-sm text-text-slate dark:text-text-secondary">
            <span>策略</span>
            <select
              className={`w-full ${opsSelectClass}`}
              value={strategy}
              onChange={(event) =>
                onPatch({
                  chunkStrategy:
                    event.target.value === 'embedding' || event.target.value === 'structure'
                      ? event.target.value
                      : 'fixed'
                })
              }
            >
              <option value="fixed">固定长度（滑动窗口）</option>
              <option value="structure">结构分割（标题 / 段落）</option>
              <option value="embedding">语义聚类（Embedding）</option>
            </select>
          </label>
          {strategy === 'embedding' && !hasActiveEmbedding && (
            <p className="mt-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100">
              Embedding 未配置，语义聚类将回退结构分割。
            </p>
          )}
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {chunkFields.map((meta) => (
              <NumberField
                key={meta.field}
                meta={meta}
                value={numberValue(ragConfig, meta.field)}
                onChange={(value) => onPatch({ [meta.field]: value })}
              />
            ))}
          </div>
        </SectionCard>

        <SectionCard title="自定义 Reindex" subtitle="手动指定扫描范围与目标存储。">
          {!hasActiveEmbedding && (
            <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100">
              Embedding 未配置，重建索引不会产生语义向量。
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-3">
            <label className="space-y-1 text-sm text-text-slate dark:text-text-secondary">
              <span>扫描上限</span>
              <input
                type="number"
                min={1}
                max={500}
                className={`w-full ${opsInputClass}`}
                value={reindexOptions.limit}
                onChange={(e) =>
                  onReindexOptionsChange({ limit: Number(e.target.value) || 1 })
                }
              />
            </label>
            <label className="space-y-1 text-sm text-text-slate dark:text-text-secondary">
              <span>目标存储</span>
              <select
                className={`w-full ${opsSelectClass}`}
                value={reindexOptions.targetStorage}
                onChange={(e) =>
                  onReindexOptionsChange({
                    targetStorage: e.target.value as ReindexTarget
                  })
                }
              >
                {TARGET_STORAGE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className={opsHintClass}>{targetStorageLabel(reindexOptions.targetStorage)}</p>
            </label>
            <div className="flex flex-col justify-end gap-2 text-sm">
              <label className="flex items-center gap-2 rounded-2xl bg-surface-soft px-3 py-2 dark:bg-white/5">
                <input
                  type="checkbox"
                  checked={reindexOptions.onlyMissing}
                  onChange={(e) => onReindexOptionsChange({ onlyMissing: e.target.checked })}
                />
                只补缺失
              </label>
              <label className="flex items-center gap-2 rounded-2xl bg-surface-soft px-3 py-2 dark:bg-white/5">
                <input
                  type="checkbox"
                  checked={reindexOptions.dryRun}
                  onChange={(e) => onReindexOptionsChange({ dryRun: e.target.checked })}
                />
                <OpsLabelWithHint label="预估范围" hint={OPS_METRIC_HINTS.dryRun} />
              </label>
            </div>
            <label className="space-y-1 text-sm md:col-span-3">
              <span>文档 ID（可选，逗号分隔）</span>
              <input
                className={`w-full ${opsInputClass}`}
                value={reindexOptions.documentIds}
                onChange={(e) => onReindexOptionsChange({ documentIds: e.target.value })}
                placeholder="doc-a, doc-b"
              />
            </label>
            <label className="space-y-1 text-sm md:col-span-3">
              <span>分类 ID（可选，逗号分隔）</span>
              <input
                className={`w-full ${opsInputClass}`}
                value={reindexOptions.categoryIds}
                onChange={(e) => onReindexOptionsChange({ categoryIds: e.target.value })}
              />
            </label>
            <label className="space-y-1 text-sm md:col-span-3">
              <span>索引版本（可选）</span>
              <input
                className={`w-full ${opsInputClass}`}
                value={reindexOptions.indexVersion}
                onChange={(e) => onReindexOptionsChange({ indexVersion: e.target.value })}
                placeholder="候选版本 ID"
              />
              <p className={opsHintClass}>仅 candidate / building 可绑定；留空写入当前激活版本。</p>
            </label>
          </div>
          <button
            type="button"
            disabled={busy === 'reindex'}
            onClick={() => void onEnqueueReindex()}
            className="btn-pill-primary !text-xs !py-1.5 !px-3 mt-3 disabled:opacity-50"
          >
            {busy === 'reindex' ? '处理中…' : reindexOptions.dryRun ? '预估范围' : '创建索引任务'}
          </button>
        </SectionCard>

        {candidateVersions.length > 0 && (
          <SectionCard title="候选版本" subtitle="绑定版本后可在上方 Reindex 表单写入目标版本。">
            <div className="space-y-2">
              {candidateVersions.map((version) => (
                <div
                  key={version.id || version.version}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-hairline-soft bg-surface-soft/60 p-3 dark:border-white/10"
                >
                  <div>
                    <p className="text-sm font-semibold text-text-ink dark:text-white">
                      {version.version || version.id}
                    </p>
                    <StatusChip label={version.status || '-'} tone="amber" />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onReindexOptionsChange({
                        indexVersion: version.version || version.id
                      });
                      onBindVersionNavigate?.(version.version || version.id);
                    }}
                    className="btn-pill-secondary !text-xs !py-1 !px-2"
                  >
                    绑定 Reindex
                  </button>
                </div>
              ))}
            </div>
          </SectionCard>
        )}
      </div>
    </details>
  );
};
