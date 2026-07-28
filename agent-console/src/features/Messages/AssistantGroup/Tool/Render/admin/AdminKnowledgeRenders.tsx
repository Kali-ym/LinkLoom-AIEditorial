import { Block, Flexbox, Icon, Tag, Text } from '@lobehub/ui';
import {
  BookOpen,
  Brain,
  CheckCircle2,
  Database,
  FileText,
  Puzzle,
  XCircle,
} from 'lucide-react';
import { memo } from 'react';

import type { BuiltinRender, BuiltinRenderProps } from '../../toolComponentTypes';
import { toolRenderStyles } from '../../shared/toolRenderStyles';
import { resolveAdminRenderResult } from './adminRenderConfig';

type AdminResult = { ok: boolean; [key: string]: unknown };

type BrowseColumn = { key: string; label: string };

const CONTENT_PREVIEW_MAX = 400;

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

function BrowseRow({ row, columns }: { row: Record<string, unknown>; columns: BrowseColumn[] }) {
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

function flattenKpis(obj: Record<string, unknown>, prefix = '', cards: { label: string; value: string }[] = []) {
  for (const [key, value] of Object.entries(obj)) {
    const label = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      flattenKpis(value as Record<string, unknown>, label, cards);
    } else if (value !== undefined && value !== null) {
      cards.push({ label, value: String(value) });
    }
  }
  return cards;
}

const BROWSE_META: Record<
  string,
  { icon: typeof BookOpen; title: string; link: string; linkLabel: string; columns: BrowseColumn[] }
> = {
  listKbCategories: {
    icon: BookOpen,
    title: '知识库分类',
    link: '/knowledge',
    linkLabel: '在 /knowledge 查看',
    columns: [
      { key: 'id', label: 'id' },
      { key: 'name', label: '名称' },
    ],
  },
  listKbDocuments: {
    icon: FileText,
    title: '知识库文档',
    link: '/knowledge',
    linkLabel: '在 /knowledge 查看文档',
    columns: [
      { key: 'id', label: 'id' },
      { key: 'name', label: '名称' },
    ],
  },
  listMemoryCategories: {
    icon: Brain,
    title: '记忆分类',
    link: '/knowledge',
    linkLabel: '在 /knowledge 查看记忆',
    columns: [
      { key: 'id', label: 'id' },
      { key: 'name', label: '名称' },
    ],
  },
};

function extractBrowseRows(apiName: string | undefined, r: AdminResult): Record<string, unknown>[] {
  if (apiName === 'listKbDocuments') {
    return Array.isArray(r.documents) ? (r.documents as Record<string, unknown>[]) : [];
  }
  if (apiName === 'listKbCategories' || apiName === 'listMemoryCategories') {
    return Array.isArray(r.categories) ? (r.categories as Record<string, unknown>[]) : [];
  }
  return [];
}

function extractBrowseCount(r: AdminResult, rows: Record<string, unknown>[]): number {
  if (typeof r.count === 'number') return r.count;
  return rows.length;
}

const MAX_ROWS = 10;

export const KnowledgeBrowseRender = memo(function KnowledgeBrowseRender({
  args,
  pluginState,
  apiName,
}: BuiltinRenderProps<AdminResult> & { apiName?: string }) {
  const r = resolveAdminRenderResult(args, pluginState);
  const meta = apiName ? BROWSE_META[apiName] : undefined;
  const icon = meta?.icon ?? BookOpen;
  const title = meta?.title ?? '知识目录';
  const rows = extractBrowseRows(apiName, r);
  const total = extractBrowseCount(r, rows);
  const displayRows = rows.slice(0, MAX_ROWS);

  return (
    <Block className={toolRenderStyles.panel} padding={12} variant="borderless" width="100%">
      <Flexbox gap={8}>
        <ResultHeader icon={icon} title={r.ok ? `${title}（共 ${total} 条）` : `${title}查询失败`} ok={!!r.ok} />
        {r.ok && meta && displayRows.length > 0 ? (
          <Flexbox gap={6}>
            {displayRows.map((row, i) => (
              <BrowseRow key={String(row.id ?? i)} row={row} columns={meta.columns} />
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

export function createKnowledgeBrowseRender(apiName: string): BuiltinRender {
  return memo(function WrappedKnowledgeBrowseRender(props: BuiltinRenderProps<AdminResult>) {
    return <KnowledgeBrowseRender {...props} apiName={apiName} />;
  });
}

export const KbContentRender = memo(function KbContentRender({
  args,
  pluginState,
}: BuiltinRenderProps<AdminResult>) {
  const r = resolveAdminRenderResult(args, pluginState);
  const rawContent = typeof r.content === 'string' ? r.content : '';
  const truncated = rawContent.length > CONTENT_PREVIEW_MAX;
  const preview = truncated ? `${rawContent.slice(0, CONTENT_PREVIEW_MAX)}…` : rawContent;

  return (
    <Block className={toolRenderStyles.panel} padding={12} variant="borderless" width="100%">
      <Flexbox gap={8}>
        <ResultHeader
          icon={FileText}
          title={r.ok ? `知识库文档（${r.documentId ?? '—'}）` : '知识库文档读取失败'}
          ok={!!r.ok}
        />
        {r.ok ? (
          <>
            {preview ? (
              <Text
                type="secondary"
                style={{ fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
              >
                {preview}
              </Text>
            ) : (
              <Text type="secondary" style={{ fontSize: 12 }}>
                （空文档）
              </Text>
            )}
            {truncated ? (
              <Text type="secondary" style={{ fontSize: 11 }}>
                已截断预览，共 {rawContent.length} 字符
              </Text>
            ) : null}
            <AdminLink href="/knowledge" label="在 /knowledge 查看完整文档" />
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

export const RagStatusRender = memo(function RagStatusRender({
  args,
  pluginState,
}: BuiltinRenderProps<AdminResult>) {
  const r = resolveAdminRenderResult(args, pluginState);
  const status = r.status && typeof r.status === 'object' ? (r.status as Record<string, unknown>) : {};
  const cards = flattenKpis(status).slice(0, 8);

  return (
    <Block className={toolRenderStyles.panel} padding={12} variant="borderless" width="100%">
      <Flexbox gap={8}>
        <ResultHeader icon={Database} title={r.ok ? 'RAG 检索状态' : 'RAG 状态查询失败'} ok={!!r.ok} />
        {r.ok ? (
          <>
            {cards.length > 0 ? (
              <Flexbox horizontal gap={12} style={{ flexWrap: 'wrap' }}>
                {cards.map((card) => (
                  <Flexbox key={card.label} gap={2} style={{ minWidth: 100 }}>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {card.label}
                    </Text>
                    <Text strong style={{ fontSize: 15 }}>
                      {card.value}
                    </Text>
                  </Flexbox>
                ))}
              </Flexbox>
            ) : null}
            <AdminLink href="/settings" label="在 /settings 查看 RAG 配置" />
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

export const PluginMetadataRender = memo(function PluginMetadataRender({
  args,
  pluginState,
}: BuiltinRenderProps<AdminResult>) {
  const r = resolveAdminRenderResult(args, pluginState);
  const plugins = Array.isArray(r.plugins) ? (r.plugins as Record<string, unknown>[]) : [];
  const display = plugins.slice(0, MAX_ROWS);
  const total = typeof r.count === 'number' ? r.count : plugins.length;

  return (
    <Block className={toolRenderStyles.panel} padding={12} variant="borderless" width="100%">
      <Flexbox gap={8}>
        <ResultHeader icon={Puzzle} title={r.ok ? `插件元数据（共 ${total} 个）` : '插件元数据查询失败'} ok={!!r.ok} />
        {r.ok && display.length > 0 ? (
          <Flexbox gap={6}>
            {display.map((row, i) => (
              <BrowseRow
                key={String(row.id ?? i)}
                row={row}
                columns={[
                  { key: 'id', label: 'id' },
                  { key: 'name', label: '名称' },
                ]}
              />
            ))}
            {plugins.length > MAX_ROWS ? (
              <Text type="secondary" style={{ fontSize: 12 }}>
                …仅显示前 {MAX_ROWS} 个，共 {plugins.length} 个
              </Text>
            ) : null}
          </Flexbox>
        ) : null}
        {r.ok ? <AdminLink href="/settings" label="在 /settings 查看插件" /> : null}
        {!r.ok ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {String(r.message ?? r.hint ?? '')}
          </Text>
        ) : null}
      </Flexbox>
    </Block>
  );
});

export const KbCategoryCreatedRender = memo(function KbCategoryCreatedRender({
  args,
  pluginState,
}: BuiltinRenderProps<AdminResult>) {
  const r = resolveAdminRenderResult(args, pluginState);
  const categoryId = String(r.id ?? '—');
  const categoryName = String(r.name ?? categoryId);

  return (
    <Block className={toolRenderStyles.panel} padding={12} variant="borderless" width="100%">
      <Flexbox gap={8}>
        <ResultHeader
          icon={BookOpen}
          title={r.ok ? `知识库分类已创建（${categoryName}）` : '知识库分类创建失败'}
          ok={!!r.ok}
        />
        {r.ok ? (
          <>
            <Flexbox horizontal align="center" gap={8} style={{ flexWrap: 'wrap' }}>
              <Tag>id</Tag>
              <Text>{categoryId}</Text>
              <Tag>名称</Tag>
              <Text>{categoryName}</Text>
            </Flexbox>
            <AdminLink href="/knowledge" label="在 /knowledge 查看分类" />
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
