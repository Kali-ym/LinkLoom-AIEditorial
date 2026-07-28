export type ReindexTarget = 'jsonb_embedding' | 'pgvector' | 'dual';

export function labelSearchStatus(status?: string): string {
  switch (status) {
    case 'ok':
      return '检索成功';
    case 'invalid_input':
      return '输入无效';
    case 'empty':
      return '无结果';
    default:
      return status || '-';
  }
}

export function labelRuntimeMode(mode?: string): string {
  if (mode === 'hybrid+rerank') return '混合检索 + 精排';
  if (mode === 'hybrid') return '混合检索';
  if (mode === 'degraded') return '已降级';
  return '全文检索';
}

export function labelReadiness(readiness?: string): string {
  switch (readiness) {
    case 'hybrid_ready':
      return '混合检索就绪';
    case 'indexing':
      return '索引构建中';
    case 'rebuild_required':
      return '需重建索引';
    case 'degraded':
      return '已降级';
    case 'fts_only':
      return '全文检索';
    case 'disabled':
      return '未启用';
    default:
      return '状态未知';
  }
}

export function labelVectorStorageMode(mode?: string): string {
  switch (mode) {
    case 'pgvector_active':
      return '向量库生效';
    case 'pgvector_available':
      return '向量库可用';
    case 'jsonb_embedding':
      return '备用向量索引';
    case 'unavailable':
      return '向量存储不可用';
    default:
      return mode || '-';
  }
}

export function labelFallbackReason(reason?: string): string {
  switch (reason) {
    case 'hybrid_disabled':
      return '混合检索已关闭，当前使用全文检索。';
    case 'embedding_service_unavailable':
      return '向量模型未配置，当前使用全文检索。';
    case 'vector_coverage_below_threshold':
      return '语义索引覆盖率低于门槛，已降级到全文检索。';
    case 'embedding_jobs_pending':
      return '仍有索引任务待处理。';
    case 'dimension_mismatch':
      return '向量维度与数据库索引不一致，需重建索引。';
    case 'pgvector_extension_missing':
    case 'pgvector_unavailable_jsonb_fallback':
    case 'vector_extension_missing':
      return '向量库不可用，已回退备用索引或全文检索。';
    case 'rerank_failed':
      return '精排失败，保留混合检索结果。';
    default:
      return reason || '';
  }
}

export function jobStatusLabel(status?: string): string {
  switch (status) {
    case 'pending':
      return '等待处理';
    case 'running':
      return '处理中';
    case 'success':
      return '已完成';
    case 'skipped':
      return '已跳过';
    case 'failed':
      return '失败';
    default:
      return status || '-';
  }
}

export function targetStorageLabel(value: ReindexTarget): string {
  if (value === 'dual') return '双写：优先向量库，保留备用索引';
  if (value === 'pgvector') return '仅写入向量库';
  return '仅写入备用向量索引';
}

export const TARGET_STORAGE_OPTIONS: Array<{ value: ReindexTarget; label: string }> = [
  { value: 'dual', label: '双写（推荐）' },
  { value: 'pgvector', label: '向量库' },
  { value: 'jsonb_embedding', label: '备用向量索引' }
];

export function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function percentFromThreshold(value: unknown): string {
  const raw = typeof value === 'number' && Number.isFinite(value) ? value : 0.8;
  const percent = raw <= 1 ? raw * 100 : raw;
  return `${Math.round(percent)}%`;
}

export function formatPercent(value: unknown): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return `${Math.round(value * 100) / 100}%`;
}

export function boolValue(config: Record<string, unknown>, field: string): boolean {
  return config[field] === true;
}

export function numberValue(config: Record<string, unknown>, field: string): number | string {
  const value = config[field];
  return typeof value === 'number' && Number.isFinite(value) ? value : '';
}

export function parseCsv(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}
