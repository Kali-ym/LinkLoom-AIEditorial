import { Alert, Block, Flexbox, Highlighter, Tag, Text } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { memo } from 'react';

import type { BuiltinRenderProps } from '../../toolComponentTypes';
import { extname, basename } from '../../../../../../utils/filePath';
import { FileChangeDiff } from '../../../../../../components/FileChangeDiff';
import { FileDiffRender } from '../../shared/FileDiffRender';
import { resolveEditFileDiff } from './editFileDiff';

const listStyles = createStaticStyles(({ css, cssVar }) => ({
  item: css`
    padding-block: 6px;
    padding-inline: 8px;
    border-block-end: 1px dashed ${cssVar.colorBorderSecondary};
    font-size: 12px;
    font-family: ${cssVar.fontFamilyCode};
    &:last-child {
      border-block-end: none;
    }
  `,
}));

function pickContent(content?: string | null, pluginState?: unknown): string {
  if (content?.trim()) return content;
  if (pluginState && typeof pluginState === 'object' && pluginState !== null) {
    const ps = pluginState as Record<string, unknown>;
    if (typeof ps.content === 'string') return ps.content;
    if (typeof ps.output === 'string') return ps.output;
    if (typeof ps.text === 'string') return ps.text;
  }
  return '';
}

export const EditFileRender = memo(function EditFileRender({
  args,
  content,
  pluginState,
}: BuiltinRenderProps<
  {
    file_path?: string;
    new_string?: string;
    old_string?: string;
    path?: string;
    search?: string;
    replace?: string;
  },
  { replacements?: number; bytesWritten?: number; path?: string }
>) {
  const { filePath, oldContent, newContent } = resolveEditFileDiff(args, content);
  const meta = pluginState && typeof pluginState === 'object' ? pluginState : undefined;
  const replacements = meta?.replacements;

  if (!oldContent && !newContent) return null;

  return (
    <FileDiffRender
      footer={
        typeof replacements === 'number' && replacements > 0 ? (
          <Text style={{ fontSize: 12 }} type="secondary">
            已替换 {replacements} 处
          </Text>
        ) : null
      }
      kind="modify"
      newContent={newContent}
      oldContent={oldContent}
      path={filePath}
    />
  );
});

export const ReadFileRender = memo(function ReadFileRender({
  args,
  content,
}: BuiltinRenderProps<{ file_path?: string; path?: string }>) {
  const body = pickContent(content, undefined);
  if (!body) return null;
  const filePath = args?.file_path || args?.path || '';
  const ext = filePath ? extname(filePath) : 'text';
  return (
    <Highlighter language={ext || 'text'} showLanguage={false} style={{ maxHeight: 280, overflow: 'auto' }} variant="borderless" wrap>
      {body}
    </Highlighter>
  );
});

export const WriteFileRender = memo(function WriteFileRender({
  args,
  content,
}: BuiltinRenderProps<{ content?: string; file_path?: string; path?: string }>) {
  const filePath = args?.file_path || args?.path || '';
  const body = args?.content ?? pickContent(content, undefined);
  if (!body) return null;
  return <FileDiffRender kind="create" maxHeight={280} newContent={body} path={filePath} />;
});

export const DeleteFileRender = memo(function DeleteFileRender({
  args,
  content,
}: BuiltinRenderProps<{ content?: string; file_path?: string; path?: string }>) {
  const filePath = args?.file_path || args?.path || '';
  const body = args?.content ?? pickContent(content, undefined);
  if (!body && !filePath) return null;
  return (
    <Flexbox gap={12} paddingInline={8}>
      <FileChangeDiff kind="delete" maxHeight={280} oldContent={body} path={filePath} />
    </Flexbox>
  );
});

export const ListFilesRender = memo(function ListFilesRender({
  content,
  pluginState,
}: BuiltinRenderProps<Record<string, unknown>>) {
  let items: string[] = [];
  if (pluginState && typeof pluginState === 'object' && Array.isArray((pluginState as { files?: string[] }).files)) {
    items = (pluginState as { files: string[] }).files;
  } else if (content) {
    items = content.split('\n').filter(Boolean);
  }
  if (!items.length && content) {
    return (
      <Highlighter language="text" showLanguage={false} variant="borderless" wrap>
        {content}
      </Highlighter>
    );
  }
  return (
    <Block variant="outlined" width="100%">
      {items.map((item) => (
        <div className={listStyles.item} key={item}>
          {item}
        </div>
      ))}
    </Block>
  );
});

export const SearchFilesRender = memo(function SearchFilesRender({
  args,
  content,
  pluginState,
}: BuiltinRenderProps<{ query?: string; pattern?: string }>) {
  const query = args?.query || args?.pattern || '';
  return (
    <Flexbox gap={8}>
      {query ? (
        <Text type="secondary" style={{ fontSize: 12 }}>
          搜索：{query}
        </Text>
      ) : null}
      <ListFilesRender
        apiName=""
        args={{}}
        content={content}
        identifier=""
        messageId=""
        pluginState={pluginState}
        toolCallId=""
      />
    </Flexbox>
  );
});

export const MoveFilesRender = memo(function MoveFilesRender({
  args,
}: BuiltinRenderProps<{ from?: string; to?: string; source?: string; destination?: string }>) {
  const from = args?.from || args?.source || '';
  const to = args?.to || args?.destination || '';
  if (!from && !to) return null;
  return (
    <Flexbox gap={4} style={{ fontSize: 13 }}>
      <Text>{from}</Text>
      <Text type="secondary">→</Text>
      <Text>{to}</Text>
    </Flexbox>
  );
});

export const ExecuteCodeResultRender = memo(function ExecuteCodeResultRender({
  args,
  content,
  pluginState,
}: BuiltinRenderProps<{ code?: string; language?: string }, { output?: string; stderr?: string }>) {
  const state = (pluginState ?? {}) as { output?: string; stderr?: string };
  const code = args?.code || '';
  const output = state.output || content || '';
  const lang = args?.language || 'python';
  return (
    <Flexbox gap={8}>
      {code ? (
        <Highlighter animated={false} language={lang} showLanguage={false} variant="outlined" wrap>
          {code}
        </Highlighter>
      ) : null}
      {output ? (
        <Highlighter language="text" showLanguage={false} style={{ maxHeight: 240, overflow: 'auto' }} variant="borderless" wrap>
          {output}
        </Highlighter>
      ) : null}
      {state.stderr ? (
        <Alert showIcon type="warning" message={state.stderr} />
      ) : null}
    </Flexbox>
  );
});

export const ExportFileRender = memo(function ExportFileRender({
  args,
  pluginState,
}: BuiltinRenderProps<{ path?: string; filename?: string }, { status?: string; url?: string }>) {
  const state = (pluginState ?? {}) as { status?: string; url?: string };
  const name = args?.path || args?.filename || 'export';
  return (
    <Block padding={12} variant="outlined" width="100%">
      <Flexbox gap={6}>
        <Text strong>{basename(name)}</Text>
        {state.status ? <Tag>{state.status}</Tag> : null}
        {state.url ? (
          <Text style={{ fontSize: 12 }} type="secondary">
            {state.url}
          </Text>
        ) : null}
      </Flexbox>
    </Block>
  );
});

export { parsePluginJson } from './parsePluginJson';
