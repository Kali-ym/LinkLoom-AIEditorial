import { Block, Flexbox, Icon, Text } from '@lobehub/ui';
import { Activity, BarChart3, CheckCircle2, Shield, XCircle } from 'lucide-react';
import { memo } from 'react';

import type { BuiltinRender, BuiltinRenderProps } from '../../toolComponentTypes';
import { toolRenderStyles } from '../../shared/toolRenderStyles';
import { resolveAdminRenderResult } from './adminRenderConfig';

type AdminResult = { ok: boolean; [key: string]: unknown };

type KpiCard = { label: string; value: string };

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
        <Icon icon={CheckCircle2} size={14} style={{ marginLeft: 'auto', color: 'var(--lobe-green)' }} />
      ) : (
        <Icon icon={XCircle} size={14} style={{ marginLeft: 'auto', color: 'var(--lobe-red)' }} />
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

function flattenObject(
  obj: Record<string, unknown>,
  prefix = '',
  cards: KpiCard[] = [],
): KpiCard[] {
  for (const [key, value] of Object.entries(obj)) {
    const label = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      flattenObject(value as Record<string, unknown>, label, cards);
    } else if (value !== undefined && value !== null) {
      cards.push({ label, value: String(value) });
    }
  }
  return cards;
}

function KpiGrid({ cards }: { cards: KpiCard[] }) {
  const display = cards.slice(0, 8);
  return (
    <Flexbox horizontal gap={12} style={{ flexWrap: 'wrap' }}>
      {display.map((card) => (
        <Flexbox key={card.label} gap={2} style={{ minWidth: 100 }}>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {card.label}
          </Text>
          <Text strong style={{ fontSize: 15 }}>
            {card.value}
          </Text>
        </Flexbox>
      ))}
      {cards.length > 8 ? (
        <Text type="secondary" style={{ fontSize: 12, alignSelf: 'flex-end' }}>
          …共 {cards.length} 项指标
        </Text>
      ) : null}
    </Flexbox>
  );
}

function resolveOpsKpis(apiName: string | undefined, r: AdminResult): KpiCard[] {
  if (apiName === 'getPlatformStatus') {
    const cards: KpiCard[] = [];
    if (r.newsPipeline && typeof r.newsPipeline === 'object') {
      flattenObject(r.newsPipeline as Record<string, unknown>, 'newsPipeline', cards);
    }
    if (r.platformPipelines && typeof r.platformPipelines === 'object') {
      flattenObject(r.platformPipelines as Record<string, unknown>, 'platformPipelines', cards);
    }
    return cards;
  }
  if (apiName === 'getGovernanceStatus' && r.governance && typeof r.governance === 'object') {
    return flattenObject(r.governance as Record<string, unknown>, 'governance');
  }
  if (apiName === 'getAgentMetrics' && r.metrics && typeof r.metrics === 'object') {
    return flattenObject(r.metrics as Record<string, unknown>, 'metrics');
  }
  return [];
}

const OPS_TITLES: Record<string, { icon: typeof Activity; title: string }> = {
  getPlatformStatus: { icon: Activity, title: '平台管线状态' },
  getGovernanceStatus: { icon: Shield, title: 'Agent 治理状态' },
  getAgentMetrics: { icon: BarChart3, title: 'Agent 可观测指标' },
};

export const OpsDashboardRender = memo(function OpsDashboardRender({
  args,
  pluginState,
  apiName,
}: BuiltinRenderProps<AdminResult> & { apiName?: string }) {
  const r = resolveAdminRenderResult(args, pluginState);
  const meta = apiName ? OPS_TITLES[apiName] : undefined;
  const icon = meta?.icon ?? Activity;
  const title = meta?.title ?? '运维状态';
  const cards = resolveOpsKpis(apiName, r);

  return (
    <Block className={toolRenderStyles.panel} padding={12} variant="borderless" width="100%">
      <Flexbox gap={8}>
        <ResultHeader icon={icon} title={r.ok ? title : `${title}查询失败`} ok={!!r.ok} />
        {r.ok ? (
          <>
            {cards.length > 0 ? <KpiGrid cards={cards} /> : null}
            <AdminLink href="/ops" label="在 /ops 查看详情" />
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

export function createOpsDashboardRender(apiName: string): BuiltinRender {
  return memo(function WrappedOpsDashboardRender(props: BuiltinRenderProps<AdminResult>) {
    return <OpsDashboardRender {...props} apiName={apiName} />;
  });
}
