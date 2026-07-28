import { Block, Flexbox, Icon, Tag, Text } from '@lobehub/ui';
import {
  Bot,
  CheckCircle2,
  Link2,
  Plug,
  Server,
  Wrench,
  XCircle,
} from 'lucide-react';
import { memo } from 'react';

import type { BuiltinRender, BuiltinRenderProps } from '../../toolComponentTypes';
import { toolRenderStyles } from '../../shared/toolRenderStyles';
import { resolveAdminRenderResult } from './adminRenderConfig';

type AdminResult = { ok: boolean; [key: string]: unknown };

type CatalogColumn = { key: string; label: string };

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

function CatalogRow({ row, columns }: { row: Record<string, unknown>; columns: CatalogColumn[] }) {
  return (
    <Flexbox horizontal align="flex-start" gap={8} style={{ flexWrap: 'wrap' }}>
      {columns.map((col) => (
        <Flexbox key={col.key} horizontal align="center" gap={4} style={{ minWidth: 100 }}>
          <Tag style={{ fontSize: 11 }}>{col.label}</Tag>
          <Text style={{ fontSize: 13, wordBreak: 'break-all' }}>{String(row[col.key] ?? '—')}</Text>
        </Flexbox>
      ))}
    </Flexbox>
  );
}

const CATALOG_META: Record<
  string,
  { icon: typeof Bot; title: string; link: string; linkLabel: string; columns: CatalogColumn[] }
> = {
  listAgents: {
    icon: Bot,
    title: '智能体目录',
    link: '/agents',
    linkLabel: '在 /agents 查看',
    columns: [
      { key: 'id', label: 'id' },
      { key: 'name', label: '名称' },
      { key: 'category', label: '分类' },
      { key: 'toolCount', label: '工具数' },
    ],
  },
  listSkills: {
    icon: Wrench,
    title: '技能目录',
    link: '/agents',
    linkLabel: '在 /agents 查看技能',
    columns: [
      { key: 'id', label: 'id' },
      { key: 'name', label: '名称' },
    ],
  },
  listTools: {
    icon: Wrench,
    title: '工具目录',
    link: '/agents',
    linkLabel: '在 /agents 查看工具',
    columns: [
      { key: 'id', label: 'id' },
      { key: 'name', label: '名称' },
      { key: 'description', label: '描述' },
    ],
  },
  listMcpConfigs: {
    icon: Server,
    title: 'MCP 配置',
    link: '/settings',
    linkLabel: '在 /settings 查看 MCP',
    columns: [
      { key: 'id', label: 'id' },
      { key: 'name', label: '名称' },
    ],
  },
  listWorkflowTemplates: {
    icon: Bot,
    title: '工作流模板',
    link: '/agents',
    linkLabel: '在 /agents 查看模板',
    columns: [
      { key: 'id', label: 'id' },
      { key: 'name', label: '名称' },
      { key: 'agentCount', label: '智能体' },
      { key: 'workflowCount', label: '工作流' },
    ],
  },
};

function extractCatalogRows(apiName: string | undefined, r: AdminResult): Record<string, unknown>[] {
  if (apiName === 'listAgents' || apiName === 'listTools') {
    return Array.isArray(r.items) ? (r.items as Record<string, unknown>[]) : [];
  }
  if (apiName === 'listSkills') {
    return Array.isArray(r.skills) ? (r.skills as Record<string, unknown>[]) : [];
  }
  if (apiName === 'listMcpConfigs') {
    return Array.isArray(r.configs) ? (r.configs as Record<string, unknown>[]) : [];
  }
  if (apiName === 'listWorkflowTemplates') {
    return Array.isArray(r.templates) ? (r.templates as Record<string, unknown>[]) : [];
  }
  return [];
}

function extractCatalogCount(_apiName: string | undefined, r: AdminResult, rows: Record<string, unknown>[]): number {
  if (typeof r.count === 'number') return r.count;
  return rows.length;
}

const MAX_ROWS = 10;

export const AgentCatalogRender = memo(function AgentCatalogRender({
  args,
  pluginState,
  apiName,
}: BuiltinRenderProps<AdminResult> & { apiName?: string }) {
  const r = resolveAdminRenderResult(args, pluginState);
  const meta = apiName ? CATALOG_META[apiName] : undefined;
  const icon = meta?.icon ?? Bot;
  const title = meta?.title ?? '目录查询';
  const rows = extractCatalogRows(apiName, r);
  const total = extractCatalogCount(apiName, r, rows);
  const displayRows = rows.slice(0, MAX_ROWS);

  return (
    <Block className={toolRenderStyles.panel} padding={12} variant="borderless" width="100%">
      <Flexbox gap={8}>
        <ResultHeader icon={icon} title={r.ok ? `${title}（共 ${total} 条）` : `${title}查询失败`} ok={!!r.ok} />
        {r.ok && meta && displayRows.length > 0 ? (
          <Flexbox gap={6}>
            {displayRows.map((row, i) => (
              <CatalogRow key={String(row.id ?? i)} row={row} columns={meta.columns} />
            ))}
            {rows.length > MAX_ROWS ? (
              <Text type="secondary" style={{ fontSize: 12 }}>
                …仅显示前 {MAX_ROWS} 条，共 {rows.length} 条
              </Text>
            ) : null}
          </Flexbox>
        ) : null}
        {r.ok && meta ? <AdminLink href={meta.link} label={meta.linkLabel} /> : null}
        {!r.ok ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {String(r.message ?? r.hint ?? '')}
          </Text>
        ) : null}
      </Flexbox>
    </Block>
  );
});

export function createAgentCatalogRender(apiName: string): BuiltinRender {
  return memo(function WrappedAgentCatalogRender(props: BuiltinRenderProps<AdminResult>) {
    return <AgentCatalogRender {...props} apiName={apiName} />;
  });
}

export const McpTestRender = memo(function McpTestRender({
  args,
  pluginState,
}: BuiltinRenderProps<AdminResult>) {
  const r = resolveAdminRenderResult(args, pluginState);
  const result = r.result && typeof r.result === 'object' ? (r.result as Record<string, unknown>) : {};
  const healthy = result.healthy === true;

  return (
    <Block className={toolRenderStyles.panel} padding={12} variant="borderless" width="100%">
      <Flexbox gap={8}>
        <ResultHeader
          icon={Plug}
          title={r.ok ? `MCP 连接测试（${r.mcpId ?? '—'}）` : 'MCP 连接测试失败'}
          ok={!!r.ok}
        />
        {r.ok ? (
          <>
            <Flexbox horizontal align="center" gap={8} style={{ flexWrap: 'wrap' }}>
              <Tag>mcpId</Tag>
              <Text>{String(r.mcpId ?? '—')}</Text>
              <Tag color={healthy ? 'green' : 'orange'}>{healthy ? '连接正常' : '连接异常'}</Tag>
            </Flexbox>
            <AdminLink href="/settings" label="在 /settings 查看 MCP 配置" />
          </>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {String(r.message ?? r.hint ?? '')}
          </Text>
        )}
      </Flexbox>
    </Block>
  );
});

export const AgentDetailRender = memo(function AgentDetailRender({
  args,
  pluginState,
}: BuiltinRenderProps<AdminResult>) {
  const r = resolveAdminRenderResult(args, pluginState);
  const agent = r.agent && typeof r.agent === 'object' ? (r.agent as Record<string, unknown>) : null;
  const toolIds = Array.isArray(agent?.toolIds) ? agent.toolIds : [];

  return (
    <Block className={toolRenderStyles.panel} padding={12} variant="borderless" width="100%">
      <Flexbox gap={8}>
        <ResultHeader
          icon={Bot}
          title={r.ok ? `智能体详情（${agent?.name ?? agent?.id ?? '—'}）` : '智能体详情查询失败'}
          ok={!!r.ok}
        />
        {r.ok && agent ? (
          <>
            <Flexbox horizontal align="center" gap={8} style={{ flexWrap: 'wrap' }}>
              <Tag>id</Tag>
              <Text>{String(agent.id ?? '—')}</Text>
              {agent.category ? (
                <>
                  <Tag>分类</Tag>
                  <Text>{String(agent.category)}</Text>
                </>
              ) : null}
              <Tag>工具数</Tag>
              <Text>{toolIds.length}</Text>
            </Flexbox>
            {agent.description ? (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {String(agent.description)}
              </Text>
            ) : null}
            <AdminLink href="/agents" label="在 /agents 查看完整配置" />
          </>
        ) : !r.ok ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {String(r.message ?? r.hint ?? '')}
          </Text>
        ) : null}
      </Flexbox>
    </Block>
  );
});

export const AgentBindingsRender = memo(function AgentBindingsRender({
  args,
  pluginState,
}: BuiltinRenderProps<AdminResult>) {
  const r = resolveAdminRenderResult(args, pluginState);
  const bindings = Array.isArray(r.bindings) ? (r.bindings as Record<string, unknown>[]) : [];
  const display = bindings.slice(0, MAX_ROWS);

  return (
    <Block className={toolRenderStyles.panel} padding={12} variant="borderless" width="100%">
      <Flexbox gap={8}>
        <ResultHeader
          icon={Link2}
          title={
            r.ok
              ? `智能体绑定（${r.agentId ?? '—'}，共 ${bindings.length} 条）`
              : '智能体绑定查询失败'
          }
          ok={!!r.ok}
        />
        {r.ok && display.length > 0 ? (
          <Flexbox gap={6}>
            {display.map((row, i) => (
              <CatalogRow
                key={String(row.id ?? i)}
                row={row}
                columns={[
                  { key: 'id', label: 'id' },
                  { key: 'resourceType', label: '类型' },
                ]}
              />
            ))}
            {bindings.length > MAX_ROWS ? (
              <Text type="secondary" style={{ fontSize: 12 }}>
                …仅显示前 {MAX_ROWS} 条，共 {bindings.length} 条
              </Text>
            ) : null}
          </Flexbox>
        ) : r.ok ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            暂无绑定资源
          </Text>
        ) : null}
        {r.ok ? <AdminLink href="/agents" label="在 /agents 管理绑定" /> : null}
        {!r.ok ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {String(r.message ?? r.hint ?? '')}
          </Text>
        ) : null}
      </Flexbox>
    </Block>
  );
});

export const AgentSavedRender = memo(function AgentSavedRender({
  args,
  pluginState,
}: BuiltinRenderProps<AdminResult>) {
  const r = resolveAdminRenderResult(args, pluginState);
  const agent = r.agent && typeof r.agent === 'object' ? (r.agent as Record<string, unknown>) : null;
  const agentId = String(r.agentId ?? agent?.id ?? '—');
  const agentName = String(agent?.name ?? agentId);

  return (
    <Block className={toolRenderStyles.panel} padding={12} variant="borderless" width="100%">
      <Flexbox gap={8}>
        <ResultHeader
          icon={Bot}
          title={r.ok ? `智能体已保存（${agentName}）` : '智能体保存失败'}
          ok={!!r.ok}
        />
        {r.ok ? (
          <>
            <Flexbox horizontal align="center" gap={8} style={{ flexWrap: 'wrap' }}>
              <Tag>id</Tag>
              <Text>{agentId}</Text>
              {agent?.category ? (
                <>
                  <Tag>分类</Tag>
                  <Text>{String(agent.category)}</Text>
                </>
              ) : null}
            </Flexbox>
            <AdminLink href="/agents" label="在 /agents 查看智能体" />
          </>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {String(r.message ?? r.hint ?? '')}
          </Text>
        )}
      </Flexbox>
    </Block>
  );
});

export const WorkflowSavedRender = memo(function WorkflowSavedRender({
  args,
  pluginState,
  apiName,
}: BuiltinRenderProps<AdminResult> & { apiName?: string }) {
  const r = resolveAdminRenderResult(args, pluginState);
  const workflow =
    r.workflow && typeof r.workflow === 'object' ? (r.workflow as Record<string, unknown>) : null;
  const workflowId = String(r.workflowId ?? workflow?.id ?? '—');
  const workflowName = String(workflow?.name ?? workflowId);
  const createdAgents = Array.isArray(r.createdAgents) ? r.createdAgents : [];
  const createdWorkflows = Array.isArray(r.createdWorkflows) ? r.createdWorkflows : [];
  const isTemplate = apiName === 'instantiateTemplate';

  return (
    <Block className={toolRenderStyles.panel} padding={12} variant="borderless" width="100%">
      <Flexbox gap={8}>
        <ResultHeader
          icon={Bot}
          title={
            r.ok
              ? isTemplate
                ? `模板已实例化（${r.templateId ?? '—'}）`
                : `工作流已保存（${workflowName}）`
              : isTemplate
                ? '模板实例化失败'
                : '工作流保存失败'
          }
          ok={!!r.ok}
        />
        {r.ok ? (
          <>
            {isTemplate ? (
              <Flexbox horizontal align="center" gap={8} style={{ flexWrap: 'wrap' }}>
                <Tag>智能体</Tag>
                <Text>{createdAgents.length} 个</Text>
                <Tag>工作流</Tag>
                <Text>{createdWorkflows.length} 个</Text>
              </Flexbox>
            ) : (
              <Flexbox horizontal align="center" gap={8} style={{ flexWrap: 'wrap' }}>
                <Tag>id</Tag>
                <Text>{workflowId}</Text>
              </Flexbox>
            )}
            <AdminLink href="/agents" label="在 /agents 查看" />
          </>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {String(r.message ?? r.hint ?? '')}
          </Text>
        )}
      </Flexbox>
    </Block>
  );
});

export function createWorkflowSavedRender(apiName: string): BuiltinRender {
  return memo(function WrappedWorkflowSavedRender(props: BuiltinRenderProps<AdminResult>) {
    return <WorkflowSavedRender {...props} apiName={apiName} />;
  });
}
