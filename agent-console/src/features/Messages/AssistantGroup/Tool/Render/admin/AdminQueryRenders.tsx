import { Block, Flexbox, Icon, Tag, Text } from '@lobehub/ui';
import { CheckCircle2, Table2, XCircle } from 'lucide-react';
import { memo } from 'react';

import type { BuiltinRender, BuiltinRenderProps } from '../../toolComponentTypes';
import { toolRenderStyles } from '../../shared/toolRenderStyles';
import {
  ADMIN_QUERY_RENDER_API_NAMES,
  resolveAdminRenderResult,
} from './adminRenderConfig';
import {
  ADMIN_QUERY_RENDER_META,
  getQueryResultCount,
  normalizeQueryRows,
  type QueryColumnDef,
} from './adminQueryRenderConfig';

const MAX_ROWS = 10;

function QueryTableRow({
  row,
  columns,
}: {
  row: Record<string, unknown>;
  columns: QueryColumnDef[];
}) {
  return (
    <Flexbox horizontal align="flex-start" gap={8} style={{ flexWrap: 'wrap' }}>
      {columns.map((col) => (
        <Flexbox key={col.key} horizontal align="center" gap={4} style={{ minWidth: 120 }}>
          <Tag style={{ fontSize: 11 }}>{col.label}</Tag>
          <Text style={{ fontSize: 13, wordBreak: 'break-all' }}>
            {col.format ? col.format(row) : String(row[col.key] ?? '—')}
          </Text>
        </Flexbox>
      ))}
    </Flexbox>
  );
}

export const AdminQueryResultRender = memo(function AdminQueryResultRender({
  args,
  pluginState,
  apiName,
}: BuiltinRenderProps<Record<string, unknown>> & { apiName?: string }) {
  const r = resolveAdminRenderResult(args, pluginState);
  const meta = apiName ? ADMIN_QUERY_RENDER_META[apiName as keyof typeof ADMIN_QUERY_RENDER_META] : undefined;
  const rows = apiName ? normalizeQueryRows(apiName, r) : [];
  const total = apiName ? getQueryResultCount(apiName, r) : 0;
  const displayRows = rows.slice(0, MAX_ROWS);

  return (
    <Block className={toolRenderStyles.panel} padding={12} variant="borderless" width="100%">
      <Flexbox gap={8}>
        <Flexbox horizontal align="center" gap={8}>
          <Icon icon={Table2} size={16} />
          <Text strong>{r.ok ? `查询完成（共 ${total} 条）` : '查询失败'}</Text>
          {r.ok ? (
            <Tag color="green" style={{ marginLeft: 'auto' }}>
              <Icon icon={CheckCircle2} size={12} /> 成功
            </Tag>
          ) : (
            <Tag color="red" style={{ marginLeft: 'auto' }}>
              <Icon icon={XCircle} size={12} /> 失败
            </Tag>
          )}
        </Flexbox>
        {r.ok && meta && displayRows.length > 0 ? (
          <Flexbox gap={6}>
            {displayRows.map((row, i) => (
              <QueryTableRow key={String(row.id ?? i)} row={row} columns={meta.columns} />
            ))}
            {rows.length > MAX_ROWS ? (
              <Text type="secondary" style={{ fontSize: 12 }}>
                …仅显示前 {MAX_ROWS} 条，共 {rows.length} 条
              </Text>
            ) : null}
          </Flexbox>
        ) : null}
        {r.ok && meta ? (
          <a href={meta.link} style={{ color: 'inherit', textDecoration: 'underline', fontSize: 13 }}>
            {meta.linkLabel}
          </a>
        ) : null}
        {!r.ok ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {String(r.message ?? '')}
          </Text>
        ) : null}
      </Flexbox>
    </Block>
  );
});

export function createAdminQueryRender(apiName: string): BuiltinRender {
  return memo(function WrappedQueryRender(props: BuiltinRenderProps<Record<string, unknown>>) {
    return <AdminQueryResultRender {...props} apiName={apiName} />;
  });
}

export const ADMIN_QUERY_RENDERS = Object.fromEntries(
  ADMIN_QUERY_RENDER_API_NAMES.map((apiName) => [apiName, createAdminQueryRender(apiName)]),
) as Record<(typeof ADMIN_QUERY_RENDER_API_NAMES)[number], BuiltinRender>;
