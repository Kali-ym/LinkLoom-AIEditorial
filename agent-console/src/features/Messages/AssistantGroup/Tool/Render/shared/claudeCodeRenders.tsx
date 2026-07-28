import {
  Block,
  Button,
  Flexbox,
  Highlighter,
  Icon,
  Markdown,
  Skeleton,
  Tag,
  Text,
} from '@lobehub/ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { CircleCheckBig, ListTree, Sparkles } from 'lucide-react';
import { memo } from 'react';

import type { BuiltinRenderProps, BuiltinStreamingProps } from '../../toolComponentTypes';
import { extname } from '../../../../../../utils/filePath';
import { FileDiffRender } from '../../shared/FileDiffRender';
import { toolRenderStyles } from '../../shared/toolRenderStyles';
import { promptBoxStyles } from '../../Streaming/shared';
import { TodoPanel, type TodoPanelItem } from './TodoPanel';

export const TodoWriteRender = memo(function TodoWriteRender({
  args,
}: BuiltinRenderProps<{ todos?: TodoPanelItem[] }>) {
  return <TodoPanel todos={args?.todos} />;
});

export const TaskRender = memo(function TaskRender({
  args,
  pluginState,
}: BuiltinRenderProps<Record<string, unknown>, { todos?: TodoPanelItem[] }>) {
  const todos = (pluginState as { todos?: TodoPanelItem[] } | undefined)?.todos ?? (args?.todos as TodoPanelItem[] | undefined);
  return <TodoPanel todos={todos} />;
});

export const EditRender = memo(function EditRender({
  args,
}: BuiltinRenderProps<{ file_path?: string; new_string?: string; old_string?: string }>) {
  if (!args) return <Skeleton active />;
  const filePath = args.file_path || '';
  return (
    <FileDiffRender
      kind="modify"
      maxHeight={240}
      newContent={args.new_string ?? ''}
      oldContent={args.old_string ?? ''}
      path={filePath}
    />
  );
});

export const WriteRender = memo(function WriteRender({
  args,
}: BuiltinRenderProps<{ content?: string; file_path?: string }>) {
  if (!args) return <Skeleton active />;
  if (!args.content) return null;
  return (
    <FileDiffRender
      kind="create"
      maxHeight={240}
      newContent={args.content}
      path={args.file_path || ''}
    />
  );
});

export const GlobRender = memo(function GlobRender({ content }: BuiltinRenderProps) {
  if (!content) return null;
  return (
    <Highlighter language="text" showLanguage={false} style={{ maxHeight: 240, overflow: 'auto' }} variant="borderless" wrap>
      {content}
    </Highlighter>
  );
});

export const GrepRender = GlobRender;

export const ReadRender = memo(function ReadRender({
  args,
  content,
}: BuiltinRenderProps<{ file_path?: string }>) {
  if (!content) return null;
  const ext = args?.file_path ? extname(args.file_path) : 'text';
  return (
    <Highlighter language={ext || 'text'} showLanguage={false} style={{ maxHeight: 240, overflow: 'auto' }} variant="borderless" wrap>
      {content}
    </Highlighter>
  );
});

const skillStyles = createStaticStyles(({ css, cssVar }) => ({
  header: css`
    padding-inline: 4px;
    color: ${cssVar.colorTextSecondary};
  `,
  previewBox: css`
    overflow: hidden;
    padding-block: 4px;
    padding-inline: 8px;
    border-radius: 8px;
    background: ${cssVar.colorFillTertiary};
  `,
}));

export const SkillRender = memo(function SkillRender({ args, content }: BuiltinRenderProps<{ skill?: string }>) {
  return (
    <Flexbox gap={8} style={{ paddingBlock: 4 }}>
      <Flexbox horizontal align="center" className={skillStyles.header} gap={8}>
        <Icon icon={Sparkles} size="small" />
        <Text strong>{args?.skill || 'Skill'}</Text>
      </Flexbox>
      {content ? (
        <Flexbox className={skillStyles.previewBox}>
          <Markdown style={{ maxHeight: 240, overflow: 'auto' }} variant="chat">
            {content}
          </Markdown>
        </Flexbox>
      ) : null}
    </Flexbox>
  );
});

export const AgentRender = memo(function AgentRender({
  args,
  content,
}: BuiltinRenderProps<{ prompt?: string }>) {
  const prompt = args?.prompt?.trim() || content?.trim();
  if (!prompt) return null;
  return (
    <Flexbox gap={12} style={{ paddingBlock: 4 }}>
      <Flexbox>
        <Flexbox horizontal align="center" justify="space-between" style={{ marginBlockEnd: 4 }}>
          <Text className={promptBoxStyles.label}>指令</Text>
          <Button className={promptBoxStyles.label} disabled icon={ListTree} size="small" type="text">
            打开子话题
          </Button>
        </Flexbox>
        <Flexbox className={promptBoxStyles.promptBox}>
          <Markdown variant="chat">{prompt}</Markdown>
        </Flexbox>
      </Flexbox>
    </Flexbox>
  );
});

export const AskUserQuestionRender = memo(function AskUserQuestionRender({
  args,
  content,
}: BuiltinRenderProps<{ question?: string; answer?: string }>) {
  const question = args?.question || content;
  const answer = args?.answer;
  return (
    <Block className={toolRenderStyles.panel} padding={12} variant="borderless" width="100%">
      <Flexbox gap={8}>
        {question ? <Text>{question}</Text> : null}
        {answer ? (
          <Flexbox horizontal align="center" gap={6}>
            <Icon icon={CircleCheckBig} size={14} style={{ color: cssVar.colorSuccess }} />
            <Text type="secondary">{answer}</Text>
          </Flexbox>
        ) : null}
      </Flexbox>
    </Block>
  );
});

export const WebFetchRender = memo(function WebFetchRender({
  args,
  content,
}: BuiltinRenderProps<{ url?: string }>) {
  const url = args?.url;
  const body = content?.trim();
  return (
    <Flexbox gap={8}>
      {url ? (
        <Tag icon={<Icon icon={ListTree} size={12} />}>{url}</Tag>
      ) : null}
      {body ? (
        <Markdown style={{ maxHeight: 280, overflow: 'auto' }} variant="chat">
          {body}
        </Markdown>
      ) : null}
    </Flexbox>
  );
});

export const WebSearchRender = memo(function WebSearchRender({
  args,
  content,
  pluginState,
}: BuiltinRenderProps<{ query?: string }, { results?: { title?: string; url?: string }[] }>) {
  const query = args?.query;
  const results = (pluginState as { results?: { title?: string; url?: string }[] } | undefined)?.results;
  return (
    <Flexbox gap={8}>
      {query ? <Text strong>搜索：{query}</Text> : null}
      {results?.length ? (
        <Block variant="outlined" width="100%">
          {results.map((r, i) => (
            <Flexbox gap={2} key={i} style={{ padding: '8px 12px', borderBottom: '1px dashed var(--console-vars-color-border-secondary)' }}>
              <Text ellipsis>{r.title || r.url}</Text>
              {r.url ? (
                <Text style={{ fontSize: 11 }} type="secondary">
                  {r.url}
                </Text>
              ) : null}
            </Flexbox>
          ))}
        </Block>
      ) : content ? (
        <Markdown variant="chat">{content}</Markdown>
      ) : null}
    </Flexbox>
  );
});

/** §C.43 streaming — Agent tool mid-flight */
export const AgentStreaming = memo(function AgentStreaming({
  args,
}: BuiltinStreamingProps<{ prompt?: string }>) {
  return <AgentRender args={args} apiName="" identifier="" messageId="" toolCallId="" />;
});
