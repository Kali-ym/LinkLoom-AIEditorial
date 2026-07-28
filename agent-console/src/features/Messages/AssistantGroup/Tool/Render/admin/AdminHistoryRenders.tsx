import { Block, Flexbox, Icon, Tag, Text } from '@lobehub/ui';
import { CheckCircle2, History, Send, Trash2, XCircle } from 'lucide-react';
import { memo } from 'react';

import type { BuiltinRender, BuiltinRenderProps } from '../../toolComponentTypes';
import { toolRenderStyles } from '../../shared/toolRenderStyles';
import { resolveAdminRenderResult } from './adminRenderConfig';

type AdminResult = { ok: boolean; [key: string]: unknown };

const MAX_COMMITS = 5;

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

export const HistoryCommitRender = memo(function HistoryCommitRender({
  args,
  pluginState,
  apiName,
}: BuiltinRenderProps<AdminResult> & { apiName?: string }) {
  const r = resolveAdminRenderResult(args, pluginState);
  const isRepublish = apiName === 'republishReport';
  const isDelete = apiName === 'deleteCommitHistory';

  if (isRepublish) {
    const results = (Array.isArray(r.results) ? r.results : []) as Array<{
      channel: string;
      ok: boolean;
      error?: string;
    }>;
    return (
      <Block className={toolRenderStyles.panel} padding={12} variant="borderless" width="100%">
        <Flexbox gap={8}>
          <ResultHeader
            icon={Send}
            title={r.ok ? `已重新发布（${r.date ?? r.id ?? ''}）` : '重新发布失败'}
            ok={!!r.ok}
          />
          {r.ok ? (
            <>
              {results.length > 0 ? (
                <Flexbox gap={4}>
                  {results.map((res) => (
                    <Flexbox key={res.channel} horizontal align="center" gap={8}>
                      <Icon icon={res.ok ? CheckCircle2 : XCircle} size={14} />
                      <Text>{res.channel}</Text>
                      {!res.ok && res.error ? (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {res.error}
                        </Text>
                      ) : null}
                    </Flexbox>
                  ))}
                </Flexbox>
              ) : null}
              <AdminLink href="/history" label="在 /history 查看发布记录" />
            </>
          ) : (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {String(r.message ?? '')}
            </Text>
          )}
        </Flexbox>
      </Block>
    );
  }

  if (isDelete) {
    return (
      <Block className={toolRenderStyles.panel} padding={12} variant="borderless" width="100%">
        <Flexbox gap={8}>
          <ResultHeader
            icon={Trash2}
            title={r.ok ? '发布存档已删除' : '删除发布存档失败'}
            ok={!!r.ok}
          />
          {r.ok ? (
            <AdminLink href="/history" label="在 /history 查看" />
          ) : (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {String(r.message ?? '')}
            </Text>
          )}
        </Flexbox>
      </Block>
    );
  }

  const commits = (Array.isArray(r.commits) ? r.commits : []) as Array<Record<string, unknown>>;
  const total = typeof r.total === 'number' ? r.total : commits.length;
  const displayRows = commits.slice(0, MAX_COMMITS);

  return (
    <Block className={toolRenderStyles.panel} padding={12} variant="borderless" width="100%">
      <Flexbox gap={8}>
        <ResultHeader
          icon={History}
          title={r.ok ? `发布历史（共 ${total} 条）` : '发布历史查询失败'}
          ok={!!r.ok}
        />
        {r.ok && displayRows.length > 0 ? (
          <Flexbox gap={6}>
            {displayRows.map((row, i) => (
              <Flexbox key={String(row.id ?? i)} horizontal align="center" gap={8} style={{ flexWrap: 'wrap' }}>
                <Tag>{String(row.date ?? '—')}</Tag>
                <Tag>{String(row.platform ?? '—')}</Tag>
                <Text style={{ fontSize: 13 }}>{String(row.title ?? row.id ?? '—')}</Text>
              </Flexbox>
            ))}
            {commits.length > MAX_COMMITS ? (
              <Text type="secondary" style={{ fontSize: 12 }}>
                …仅显示前 {MAX_COMMITS} 条，共 {commits.length} 条
              </Text>
            ) : null}
          </Flexbox>
        ) : null}
        {r.ok ? <AdminLink href="/history" label="在 /history 查看" /> : null}
        {!r.ok ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {String(r.message ?? '')}
          </Text>
        ) : null}
      </Flexbox>
    </Block>
  );
});

export function createHistoryCommitRender(apiName: string): BuiltinRender {
  return memo(function WrappedHistoryCommitRender(props: BuiltinRenderProps<AdminResult>) {
    return <HistoryCommitRender {...props} apiName={apiName} />;
  });
}
