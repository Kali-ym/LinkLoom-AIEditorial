import { Block, Flexbox, Icon, Tag, Text } from '@lobehub/ui';
import { CheckCircle2, FileText, PlayCircle, RefreshCw, XCircle } from 'lucide-react';
import { memo } from 'react';

import type { BuiltinRender, BuiltinRenderProps } from '../../toolComponentTypes';
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

function extractStoryCount(report: unknown): number | undefined {
  if (!report || typeof report !== 'object') return undefined;
  const r = report as Record<string, unknown>;
  if (Array.isArray(r.stories)) return r.stories.length;
  if (typeof r.storyCount === 'number') return r.storyCount;
  return undefined;
}

function extractReportSummary(report: unknown): string | undefined {
  if (!report || typeof report !== 'object') return undefined;
  const r = report as Record<string, unknown>;
  if (typeof r.summary === 'string' && r.summary.trim()) return r.summary;
  if (typeof r.title === 'string' && r.title.trim()) return r.title;
  return undefined;
}

export const ReportPreviewRender = memo(function ReportPreviewRender({
  args,
  pluginState,
}: BuiltinRenderProps<AdminResult>) {
  const r = resolveAdminRenderResult(args, pluginState);
  const storyCount = extractStoryCount(r.report);
  const summary = extractReportSummary(r.report);

  return (
    <Block className={toolRenderStyles.panel} padding={12} variant="borderless" width="100%">
      <Flexbox gap={8}>
        <ResultHeader
          icon={FileText}
          title={r.ok ? `日报预览（${r.date ?? '今日'}）` : '日报预览失败'}
          ok={!!r.ok}
        />
        {r.ok ? (
          <>
            <Flexbox horizontal align="center" gap={8} style={{ flexWrap: 'wrap' }}>
              <Tag>日期</Tag>
              <Text>{String(r.date ?? '—')}</Text>
              {storyCount !== undefined ? (
                <>
                  <Tag>故事数</Tag>
                  <Text>{storyCount}</Text>
                </>
              ) : null}
            </Flexbox>
            {summary ? (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {summary}
              </Text>
            ) : null}
            <AdminLink href="/generation" label="在 /generation 查看完整日报" />
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

function resolveWorkflowRun(r: AdminResult): Record<string, unknown> {
  if (r.run && typeof r.run === 'object') return r.run as Record<string, unknown>;
  return r;
}

export const WorkflowDetailRender = memo(function WorkflowDetailRender({
  args,
  pluginState,
}: BuiltinRenderProps<AdminResult>) {
  const r = resolveAdminRenderResult(args, pluginState);
  const run = resolveWorkflowRun(r);
  const steps = Array.isArray(run.steps) ? run.steps : [];
  const displaySteps = steps.slice(0, 5) as Array<Record<string, unknown>>;

  return (
    <Block className={toolRenderStyles.panel} padding={12} variant="borderless" width="100%">
      <Flexbox gap={8}>
        <ResultHeader
          icon={PlayCircle}
          title={r.ok ? `工作流运行「${run.workflowId ?? ''}」` : '工作流运行查询失败'}
          ok={!!r.ok}
        />
        {r.ok ? (
          <>
            <Flexbox horizontal align="center" gap={8} style={{ flexWrap: 'wrap' }}>
              <Tag>runId</Tag>
              <Text>{String(run.id ?? run.runId ?? '—')}</Text>
              <Tag>状态</Tag>
              <Text>{String(run.status ?? '—')}</Text>
            </Flexbox>
            {displaySteps.length > 0 ? (
              <Flexbox gap={4}>
                {displaySteps.map((step, i) => (
                  <Flexbox key={String(step.id ?? i)} horizontal align="center" gap={8}>
                    <Tag style={{ fontSize: 11 }}>{String(step.id ?? step.name ?? i + 1)}</Tag>
                    <Text style={{ fontSize: 13 }}>{String(step.status ?? '—')}</Text>
                  </Flexbox>
                ))}
                {steps.length > 5 ? (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    …共 {steps.length} 个步骤
                  </Text>
                ) : null}
              </Flexbox>
            ) : null}
            <AdminLink href="/ops" label="在 /ops 查看运行详情" />
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

export const RefreshDigestContextRender = memo(function RefreshDigestContextRender({
  args,
  pluginState,
}: BuiltinRenderProps<AdminResult>) {
  const r = resolveAdminRenderResult(args, pluginState);
  const triggered = Array.isArray(r.triggered) ? r.triggered : [];

  return (
    <Block className={toolRenderStyles.panel} padding={12} variant="borderless" width="100%">
      <Flexbox gap={8}>
        <ResultHeader
          icon={RefreshCw}
          title={r.ok ? '摘要上下文已刷新' : '摘要上下文刷新失败'}
          ok={!!r.ok}
        />
        {r.ok ? (
          <>
            {triggered.length > 0 ? (
              <Flexbox horizontal gap={8} style={{ flexWrap: 'wrap' }}>
                {triggered.map((id) => (
                  <Tag key={String(id)}>{String(id)}</Tag>
                ))}
              </Flexbox>
            ) : null}
            <AdminLink href="/generation" label="在 /generation 查看 digest" />
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

export function createWorkflowDetailRender(_apiName: string): BuiltinRender {
  return memo(function WrappedWorkflowDetailRender(props: BuiltinRenderProps<AdminResult>) {
    return <WorkflowDetailRender {...props} />;
  });
}
