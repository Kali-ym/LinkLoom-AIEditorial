import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  searchRagExplicit,
  type RagSearchExplicitResult
} from '../../../../../services/ragService';
import { parseCsv } from '../shared/ragStatusLabels.js';
import { opsHintClass, opsInputClass, ragTextareaClass, SectionCard } from '../shared/ragUi.js';

type Props = {
  initialQuery?: string;
  onQueryChange?: (query: string) => void;
  onSearchComplete?: (result: RagSearchExplicitResult) => void;
};

export const DiagnoseSandbox: React.FC<Props> = ({
  initialQuery = '',
  onQueryChange,
  onSearchComplete
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [categoryIds, setCategoryIds] = useState('');
  const [documentIds, setDocumentIds] = useState('');
  const [indexVersion, setIndexVersion] = useState('');
  const [limit, setLimit] = useState(5);
  const [showScope, setShowScope] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (initialQuery) setQuery(initialQuery);
  }, [initialQuery]);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    onQueryChange?.(value);
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const response = await searchRagExplicit({
        query: query.trim(),
        categoryIds: parseCsv(categoryIds),
        documentIds: parseCsv(documentIds),
        indexVersion: indexVersion.trim() || undefined,
        limit
      });
      if (response.status === 'invalid_input') {
        const msg = response.issues?.map((i) => i.message).filter(Boolean).join('；') || '输入无效';
        setError(msg);
        return;
      }
      onSearchComplete?.(response);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '检索失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SectionCard
      title="试一条查询"
      subtitle="验收检索链路，不经过答案合成。"
    >
      <textarea
        rows={2}
        value={query}
        onChange={(e) => handleQueryChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void handleSearch();
          }
        }}
        placeholder="输入检索 query…（Ctrl+Enter 试跑）"
        className={`w-full ${ragTextareaClass}`}
      />

      <button
        type="button"
        onClick={() => setShowScope((v) => !v)}
        className="mt-2 text-[12px] font-medium text-primary hover:underline"
      >
        {showScope ? '收起' : '展开'}限定范围 ▸
      </button>

      {showScope && (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span>分类 ID</span>
            <input value={categoryIds} onChange={(e) => setCategoryIds(e.target.value)} className={`w-full ${opsInputClass}`} />
          </label>
          <label className="space-y-1 text-sm">
            <span>文档 ID</span>
            <input value={documentIds} onChange={(e) => setDocumentIds(e.target.value)} className={`w-full ${opsInputClass}`} />
          </label>
          <label className="space-y-1 text-sm">
            <span>索引版本</span>
            <input value={indexVersion} onChange={(e) => setIndexVersion(e.target.value)} className={`w-full ${opsInputClass}`} />
          </label>
          <label className="space-y-1 text-sm">
            <span>返回条数</span>
            <input type="number" min={1} max={20} value={limit} onChange={(e) => setLimit(Number(e.target.value) || 5)} className={`w-full ${opsInputClass}`} />
          </label>
        </div>
      )}

      <button
        type="button"
        disabled={busy || !query.trim()}
        onClick={() => void handleSearch()}
        className="btn-pill-primary !text-xs !py-1.5 !px-3 mt-3 disabled:opacity-50"
      >
        {busy ? '试跑中…' : '试跑'}
      </button>

      {error && (
        <p className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-[12px] text-red-800 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-100">
          {error}
        </p>
      )}

      <p className={`mt-3 ${opsHintClass}`}>
        <Link to="/knowledge" className="text-primary hover:underline">
          在知识库页面试跑完整问答 →
        </Link>
      </p>
    </SectionCard>
  );
};
