import { Block, Flexbox, Icon, Tag, Text } from '@lobehub/ui';
import { BarChart3, CheckCircle2, FileSearch, XCircle } from 'lucide-react';
import { memo } from 'react';

import type { BuiltinRenderProps } from '../../toolComponentTypes';
import { toolRenderStyles } from '../../shared/toolRenderStyles';
import { resolveAdminRenderResult } from './adminRenderConfig';

type AdminResult = { ok: boolean; [key: string]: unknown };

type CoverageMatch = {
  suggestion?: string;
  prior_headline?: string;
  prior_date?: string;
  score?: number;
};

const SUGGESTION_LABELS: Record<string, string> = {
  continuation: '续报',
  drop: '丢弃',
  new_angle: '新角度',
};

function ResultHeader({
  icon,
  title,
  ok,
}: {
  icon: typeof CheckCircle2;
  title: string;
  ok: boolean;
}) {
  return (
    <Flexbox horizontal align="center" gap={8}>
      <Icon icon={icon} size={16} />
      <Text strong>{title}</Text>
      {ok ? (
        <Tag color="green" style={{ marginLeft: 'auto' }}>
          <Icon icon={CheckCircle2} size={12} /> 成功
        </Tag>
      ) : (
        <Tag color="red" style={{ marginLeft: 'auto' }}>
          <Icon icon={XCircle} size={12} /> 失败
        </Tag>
      )}
    </Flexbox>
  );
}

function AdminLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} style={{ color: 'inherit', textDecoration: 'underline', fontSize: 13 }}>
      {label}
    </a>
  );
}

function groupMatchesBySuggestion(matches: CoverageMatch[]) {
  const groups: Record<string, CoverageMatch[]> = {
    continuation: [],
    drop: [],
    new_angle: [],
  };
  for (const m of matches) {
    const key = m.suggestion === 'drop' ? 'drop' : (m.suggestion ?? 'new_angle');
    if (groups[key]) groups[key].push(m);
    else groups.new_angle.push(m);
  }
  return groups;
}

export const ContinuationReportRender = memo(function ContinuationReportRender({
  args,
  pluginState,
}: BuiltinRenderProps<AdminResult>) {
  const r = resolveAdminRenderResult(args, pluginState);
  const matches = (Array.isArray(r.matches) ? r.matches : []) as CoverageMatch[];
  const groups = groupMatchesBySuggestion(matches);

  return (
    <Block className={toolRenderStyles.panel} padding={12} variant="borderless" width="100%">
      <Flexbox gap={8}>
        <ResultHeader
          icon={FileSearch}
          title={r.ok ? '续报报告' : '续报报告查询失败'}
          ok={!!r.ok}
        />
        {r.ok ? (
          <>
            <Flexbox horizontal align="center" gap={8} style={{ flexWrap: 'wrap' }}>
              {r.asOfDate ? (
                <>
                  <Tag>基准日</Tag>
                  <Text>{String(r.asOfDate)}</Text>
                </>
              ) : null}
              {r.lookbackDays !== undefined ? (
                <>
                  <Tag>回溯</Tag>
                  <Text>{String(r.lookbackDays)} 天</Text>
                </>
              ) : null}
            </Flexbox>
            {r.summary ? (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {String(r.summary)}
              </Text>
            ) : null}
            {(['continuation', 'drop', 'new_angle'] as const).map((key) => {
              const items = groups[key];
              if (!items.length) return null;
              return (
                <Flexbox key={key} gap={4}>
                  <Text strong style={{ fontSize: 13 }}>
                    {SUGGESTION_LABELS[key]}（{items.length}）
                  </Text>
                  {items.slice(0, 5).map((m, i) => (
                    <Flexbox key={i} horizontal align="center" gap={8}>
                      <Tag style={{ fontSize: 11 }}>{m.prior_date ?? '—'}</Tag>
                      <Text style={{ fontSize: 13 }}>{m.prior_headline ?? '—'}</Text>
                      {m.score !== undefined ? (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {String(m.score)}
                        </Text>
                      ) : null}
                    </Flexbox>
                  ))}
                  {items.length > 5 ? (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      …共 {items.length} 条
                    </Text>
                  ) : null}
                </Flexbox>
              );
            })}
            <AdminLink href="/generation" label="在 /generation 查看续报历史" />
          </>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {String(r.message ?? '')}
          </Text>
        )}
      </Flexbox>
    </Block>
  );
});

const SELECTION_STAT_KEYS: Array<{ key: string; label: string }> = [
  { key: 'raw', label: '未评分' },
  { key: 'processed24h', label: '24h 处理量' },
  { key: 'failed24h', label: '24h 失败' },
  { key: 'passRate24h', label: '24h 通过率' },
  { key: 'lastDigestAt', label: '最近日报' },
];

export const SelectionStatsRender = memo(function SelectionStatsRender({
  args,
  pluginState,
}: BuiltinRenderProps<AdminResult>) {
  const r = resolveAdminRenderResult(args, pluginState);
  const stats = (r.stats && typeof r.stats === 'object' ? r.stats : {}) as Record<string, unknown>;

  return (
    <Block className={toolRenderStyles.panel} padding={12} variant="borderless" width="100%">
      <Flexbox gap={8}>
        <ResultHeader icon={BarChart3} title={r.ok ? '选题统计' : '选题统计查询失败'} ok={!!r.ok} />
        {r.ok ? (
          <>
            <Flexbox horizontal gap={12} style={{ flexWrap: 'wrap' }}>
              {SELECTION_STAT_KEYS.map(({ key, label }) => (
                <Flexbox key={key} gap={2} style={{ minWidth: 100 }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {label}
                  </Text>
                  <Text strong style={{ fontSize: 15 }}>
                    {stats[key] === null || stats[key] === undefined ? '—' : String(stats[key])}
                  </Text>
                </Flexbox>
              ))}
            </Flexbox>
            <AdminLink href="/selection" label="在 /selection 查看" />
          </>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {String(r.message ?? '')}
          </Text>
        )}
      </Flexbox>
    </Block>
  );
});
