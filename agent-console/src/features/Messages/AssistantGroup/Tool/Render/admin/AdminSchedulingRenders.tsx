import { Block, Flexbox, Icon, Tag, Text } from '@lobehub/ui';
import { CheckCircle2, RefreshCw, ScrollText, Trash2, XCircle } from 'lucide-react';
import { memo } from 'react';

import type { BuiltinRenderProps } from '../../toolComponentTypes';
import { toolRenderStyles } from '../../shared/toolRenderStyles';
import { resolveAdminRenderResult } from './adminRenderConfig';

type AdminResult = { ok: boolean; [key: string]: unknown };

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

const MAX_LOG_ROWS = 10;

export const TaskLogsRender = memo(function TaskLogsRender({
  args,
  pluginState,
}: BuiltinRenderProps<AdminResult>) {
  const r = resolveAdminRenderResult(args, pluginState);
  const items = (Array.isArray(r.items) ? r.items : []) as Array<Record<string, unknown>>;
  const total = typeof r.count === 'number' ? r.count : items.length;
  const displayRows = items.slice(0, MAX_LOG_ROWS);

  return (
    <Block className={toolRenderStyles.panel} padding={12} variant="borderless" width="100%">
      <Flexbox gap={8}>
        <ResultHeader
          icon={ScrollText}
          title={r.ok ? `任务日志（共 ${total} 条）` : '任务日志查询失败'}
          ok={!!r.ok}
        />
        {r.ok && displayRows.length > 0 ? (
          <Flexbox gap={6}>
            {displayRows.map((row, i) => (
              <Flexbox key={String(row.id ?? i)} gap={4}>
                <Flexbox horizontal align="center" gap={8} style={{ flexWrap: 'wrap' }}>
                  <Tag>{String(row.taskName ?? '—')}</Tag>
                  <Tag color={row.status === 'failed' ? 'red' : 'default'}>
                    {String(row.status ?? '—')}
                  </Tag>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {String(row.startTime ?? '—')}
                  </Text>
                </Flexbox>
                {row.message ? (
                  <Text style={{ fontSize: 13 }}>{String(row.message)}</Text>
                ) : null}
              </Flexbox>
            ))}
            {items.length > MAX_LOG_ROWS ? (
              <Text type="secondary" style={{ fontSize: 12 }}>
                …仅显示前 {MAX_LOG_ROWS} 条，共 {items.length} 条
              </Text>
            ) : null}
          </Flexbox>
        ) : null}
        {r.ok ? <AdminLink href="/scheduling" label="在 /scheduling 查看" /> : null}
        {!r.ok ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {String(r.message ?? '')}
          </Text>
        ) : null}
      </Flexbox>
    </Block>
  );
});

export const AdapterActionRender = memo(function AdapterActionRender({
  args,
  pluginState,
  apiName,
}: BuiltinRenderProps<AdminResult> & { apiName?: string }) {
  const r = resolveAdminRenderResult(args, pluginState);
  const isClear = apiName === 'clearAdapterData';
  const icon = isClear ? Trash2 : RefreshCw;
  const actionLabel = isClear ? '清理' : '同步';
  const title = r.ok
    ? `适配器「${r.adapterName ?? ''}」${actionLabel}已触发`
    : `适配器${actionLabel}失败`;

  return (
    <Block className={toolRenderStyles.panel} padding={12} variant="borderless" width="100%">
      <Flexbox gap={8}>
        <ResultHeader icon={icon} title={title} ok={!!r.ok} />
        {r.ok ? (
          <>
            <Flexbox horizontal align="center" gap={8}>
              <Tag>适配器</Tag>
              <Text>{String(r.adapterName ?? '')}</Text>
            </Flexbox>
            {r.message ? (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {String(r.message)}
              </Text>
            ) : null}
            <AdminLink href="/scheduling" label="在 /scheduling 查看" />
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

export function createAdapterActionRender(apiName: string) {
  return memo(function WrappedAdapterActionRender(props: BuiltinRenderProps<AdminResult>) {
    return <AdapterActionRender {...props} apiName={apiName} />;
  });
}
