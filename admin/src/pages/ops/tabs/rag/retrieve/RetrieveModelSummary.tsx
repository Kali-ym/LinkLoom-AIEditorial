import React from 'react';
import { Link } from 'react-router-dom';
import type { SmallModelService } from '../../../../settings/fields/ai/smallModelUtils';
import { SectionCard } from '../shared/ragUi.js';

type Props = {
  activeEmbeddingId: string;
  activeRerankId: string;
  embeddingServices: SmallModelService[];
  rerankServices: SmallModelService[];
  rerankEnabled: boolean;
  testingServiceId: string | null;
  onChangeEmbedding: (id: string) => void;
  onChangeRerank: (id: string) => void;
  onTest: (id: string, label: string) => void;
};

function serviceLabel(services: SmallModelService[], id: string): string {
  const svc = services.find((s) => s.id === id);
  return svc?.name || id || '—';
}

export const RetrieveModelSummary: React.FC<Props> = ({
  activeEmbeddingId,
  activeRerankId,
  embeddingServices,
  rerankServices,
  rerankEnabled,
  testingServiceId,
  onChangeEmbedding,
  onChangeRerank,
  onTest
}) => (
  <SectionCard
    id="rag-model-summary"
    title="模型连接"
    subtitle="日常视图显示摘要；完整选择在高级检索配置。"
  >
    <div className="grid gap-3 sm:grid-cols-2">
      <ModelRow
        label="向量模型"
        serviceId={activeEmbeddingId}
        services={embeddingServices}
        testing={testingServiceId === activeEmbeddingId}
        onChange={onChangeEmbedding}
        onTest={() => onTest(activeEmbeddingId, '向量模型')}
      />
      <ModelRow
        label="精排模型"
        serviceId={activeRerankId}
        services={rerankServices}
        testing={testingServiceId === activeRerankId}
        disabled={!rerankEnabled}
        onChange={onChangeRerank}
        onTest={() => onTest(activeRerankId, '精排模型')}
      />
    </div>
    <Link
      to="/settings"
      className="mt-3 inline-block text-[12px] font-medium text-primary hover:underline"
    >
      前往 AI 模型设置 →
    </Link>
  </SectionCard>
);

function ModelRow({
  label,
  serviceId,
  services,
  testing,
  disabled,
  onChange,
  onTest
}: {
  label: string;
  serviceId: string;
  services: SmallModelService[];
  testing?: boolean;
  disabled?: boolean;
  onChange: (id: string) => void;
  onTest: () => void;
}) {
  const configured = Boolean(serviceId && services.some((s) => s.id === serviceId));
  return (
    <div className="rounded-2xl border border-hairline-soft bg-surface-soft/40 p-3 dark:border-white/10">
      <p className="text-sm font-semibold text-text-ink dark:text-white">{label}</p>
      <p className="mt-1 text-[12px] text-text-charcoal dark:text-text-secondary">
        {configured ? (
          <>
            {serviceLabel(services, serviceId)}{' '}
            <span className="text-emerald-600 dark:text-emerald-300">已选</span>
          </>
        ) : (
          <span className="text-text-stone">{disabled ? '未启用' : '未配置'}</span>
        )}
      </p>
      {!disabled && services.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          <select
            className="rounded-xl border border-hairline-soft bg-canvas px-2 py-1 text-xs dark:border-white/10 dark:bg-surface-dark"
            value={serviceId}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">选择服务</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {serviceId && (
            <button
              type="button"
              disabled={testing}
              onClick={onTest}
              className="btn-pill-secondary !text-xs !py-1 !px-2 disabled:opacity-50"
            >
              {testing ? '测试中…' : '测试连通性'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
