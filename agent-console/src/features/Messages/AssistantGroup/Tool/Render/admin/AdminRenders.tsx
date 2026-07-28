import { Block, Flexbox, Icon, Tag, Text } from '@lobehub/ui';
import {
  CalendarClock,
  CheckCircle2,
  FileText,
  Gauge,
  Newspaper,
  PlayCircle,
  Send,
  XCircle,
} from 'lucide-react';
import { memo } from 'react';

import type { BuiltinRenderProps } from '../../toolComponentTypes';
import { toolRenderStyles } from '../../shared/toolRenderStyles';

type AdminResult = { ok: boolean; [key: string]: unknown };

function resolveAdminResult(
  args?: AdminResult,
  pluginState?: unknown,
): AdminResult {
  if (pluginState && typeof pluginState === 'object' && pluginState !== null && 'ok' in pluginState) {
    return pluginState as AdminResult;
  }
  return args || ({} as AdminResult);
}

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

function ResultHint({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <Text type="secondary" style={{ fontSize: 12 }}>
      {text}
    </Text>
  );
}

function AdminLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} style={{ color: 'inherit', textDecoration: 'underline', fontSize: 13 }}>
      {label}
    </a>
  );
}

export const CronCreatedRender = memo(function CronCreatedRender({
  args,
  pluginState,
}: BuiltinRenderProps<AdminResult>) {
  const r = resolveAdminResult(args, pluginState);
  const s = (r.schedule ?? {}) as Record<string, unknown>;
  return (
    <Block className={toolRenderStyles.panel} padding={12} variant="borderless" width="100%">
      <Flexbox gap={8}>
        <ResultHeader
          icon={CalendarClock}
          title={r.ok ? `定时任务「${s.name ?? ''}」已创建` : '定时任务操作失败'}
          ok={!!r.ok}
        />
        {r.ok ? (
          <>
            <Flexbox horizontal align="center" gap={8}>
              <Tag>cron</Tag>
              <Text>{String(s.cronExpr ?? '')}</Text>
              <Tag>状态</Tag>
              <Text>{s.enabled ? '已启用' : '未启用'}</Text>
            </Flexbox>
            <AdminLink href="/scheduling" label="在 /scheduling 查看" />
          </>
        ) : (
          <ResultHint text={String(r.message ?? '')} />
        )}
      </Flexbox>
    </Block>
  );
});

export const WorkflowRunStartedRender = memo(function WorkflowRunStartedRender({
  args,
  pluginState,
}: BuiltinRenderProps<AdminResult>) {
  const r = resolveAdminResult(args, pluginState);
  const isReport = r.workflowId === 'ai-daily-report-json-from-summary' || !!r.date;
  const title = isReport
    ? `日报生成已启动(${r.date ?? '今天'})`
    : `工作流「${r.workflowId ?? ''}」已启动`;
  return (
    <Block className={toolRenderStyles.panel} padding={12} variant="borderless" width="100%">
      <Flexbox gap={8}>
        <ResultHeader icon={PlayCircle} title={r.ok ? title : '工作流启动失败'} ok={!!r.ok} />
        {r.ok ? (
          <>
            <Flexbox horizontal align="center" gap={8}>
              <Tag>runId</Tag>
              <Text>{String(r.runId ?? '')}</Text>
              <Tag>状态</Tag>
              <Text>{String(r.status ?? 'running')}</Text>
            </Flexbox>
            <AdminLink href="/ops" label="在 /ops 查看进度" />
            {isReport ? <AdminLink href="/generation" label="在 /generation 查看结果" /> : null}
            {r.workflowId === 'feed_scoring_pipeline_workflow' ? (
              <AdminLink href="/selection" label="在 /selection 查看评分结果" />
            ) : null}
          </>
        ) : (
          <ResultHint text={String(r.message ?? '')} />
        )}
      </Flexbox>
    </Block>
  );
});

export const NewsScoreUpdatedRender = memo(function NewsScoreUpdatedRender({
  args,
  pluginState,
}: BuiltinRenderProps<AdminResult>) {
  const r = resolveAdminResult(args, pluginState);
  const scoreText =
    r.newScore === null || r.newScore === undefined ? '已清空(将重新评分)' : String(r.newScore);
  return (
    <Block className={toolRenderStyles.panel} padding={12} variant="borderless" width="100%">
      <Flexbox gap={8}>
        <ResultHeader
          icon={Gauge}
          title={r.ok ? `新闻「${r.title ?? ''}」评分已更新` : '评分更新失败'}
          ok={!!r.ok}
        />
        {r.ok ? (
          <>
            <Flexbox horizontal align="center" gap={8}>
              <Tag>原分</Tag>
              <Text>
                {r.oldScore === null || r.oldScore === undefined ? '—' : String(r.oldScore)}
              </Text>
              <Tag>新分</Tag>
              <Text>{scoreText}</Text>
            </Flexbox>
            <AdminLink href="/selection" label="在 /selection 查看" />
          </>
        ) : (
          <ResultHint text={String(r.message ?? '')} />
        )}
      </Flexbox>
    </Block>
  );
});

export const ReportPublishedRender = memo(function ReportPublishedRender({
  args,
  pluginState,
}: BuiltinRenderProps<AdminResult>) {
  const r = resolveAdminResult(args, pluginState);
  const results = (r.results ?? []) as Array<{ channel: string; ok: boolean; error?: string }>;
  return (
    <Block className={toolRenderStyles.panel} padding={12} variant="borderless" width="100%">
      <Flexbox gap={8}>
        <ResultHeader
          icon={Send}
          title={r.ok ? `日报(${r.date ?? ''})已发布` : '日报发布失败'}
          ok={!!r.ok}
        />
        {results.length > 0 ? (
          <Flexbox gap={4}>
            {results.map((res) => (
              <Flexbox key={res.channel} horizontal align="center" gap={8}>
                <Icon icon={res.ok ? CheckCircle2 : XCircle} size={14} />
                <Text>{res.channel}</Text>
                {!res.ok ? (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {res.error}
                  </Text>
                ) : null}
              </Flexbox>
            ))}
          </Flexbox>
        ) : null}
        {r.ok ? (
          <Flexbox horizontal gap={16}>
            <AdminLink href="/generation" label="在 /generation 查看" />
            <AdminLink href="/history" label="在 /history 查看发布记录" />
          </Flexbox>
        ) : (
          <ResultHint text={String(r.message ?? '')} />
        )}
      </Flexbox>
    </Block>
  );
});

export const WorkflowStepDecidedRender = memo(function WorkflowStepDecidedRender({
  args,
  pluginState,
}: BuiltinRenderProps<AdminResult>) {
  const r = resolveAdminResult(args, pluginState);
  return (
    <Block className={toolRenderStyles.panel} padding={12} variant="borderless" width="100%">
      <Flexbox gap={8}>
        <ResultHeader
          icon={CheckCircle2}
          title={
            r.ok ? `工作流步骤已${r.decision === 'approve' ? '批准' : '拒绝'}` : '审批失败'
          }
          ok={!!r.ok}
        />
        {r.ok ? (
          <>
            <Flexbox horizontal align="center" gap={8}>
              <Tag>运行</Tag>
              <Text>{String(r.runId ?? '')}</Text>
              <Tag>步骤</Tag>
              <Text>{String(r.stepId ?? '')}</Text>
              <Tag>决定</Tag>
              <Text>{r.decision === 'approve' ? '批准' : '拒绝'}</Text>
            </Flexbox>
            <AdminLink href="/ops" label="在 /ops 查看运行" />
          </>
        ) : (
          <ResultHint text={String(r.message ?? '')} />
        )}
      </Flexbox>
    </Block>
  );
});

export const GenericAdminResultRender = memo(function GenericAdminResultRender({
  args,
  pluginState,
}: BuiltinRenderProps<AdminResult>) {
  const r = resolveAdminResult(args, pluginState);
  const items = (r.items ?? []) as Array<Record<string, unknown>>;
  return (
    <Block className={toolRenderStyles.panel} padding={12} variant="borderless" width="100%">
      <Flexbox gap={8}>
        <ResultHeader
          icon={FileText}
          title={r.ok ? `查询完成(${r.count ?? r.total ?? items.length} 条)` : '查询失败'}
          ok={!!r.ok}
        />
        {r.ok && items.length > 0 ? (
          <Flexbox gap={4}>
            {items.slice(0, 5).map((it, i) => (
              <Flexbox key={String(it.id ?? i)} horizontal align="center" gap={8}>
                <Icon icon={Newspaper} size={14} />
                <Text style={{ fontSize: 13 }}>{String(it.title ?? it.name ?? it.id ?? '')}</Text>
              </Flexbox>
            ))}
            {items.length > 5 ? (
              <Text type="secondary" style={{ fontSize: 12 }}>
                …共 {items.length} 条
              </Text>
            ) : null}
          </Flexbox>
        ) : null}
        {!r.ok ? <ResultHint text={String(r.message ?? '')} /> : null}
      </Flexbox>
    </Block>
  );
});
