import { Avatar, Block, Flexbox, Highlighter, Icon, Markdown, Tag, Text } from '@lobehub/ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { FileText, Hash, ListChecks, ListTree } from 'lucide-react';
import { memo, useMemo } from 'react';

import { AnimatedNumber } from '../../../../../components/AnimatedNumber';
import { BubblesLoading } from '../../../../../components/BubblesLoading';
import { NeuralNetworkLoading } from '../../../../../components/NeuralNetworkLoading';
import { StreamingMarkdown } from '../../../../../components/StreamingMarkdown';
import type { BuiltinStreamingProps } from '../toolComponentTypes';
import { FileDiffRender } from '../shared/FileDiffRender';
import { InstructionMarkdown, MarkdownPromptBlock, RunCommandView } from './shared';
import { resolveEditFileDiff } from '../Render/shared/editFileDiff';

const docCardStyles = createStaticStyles(({ css, cssVar }) => ({
  container: css`
    overflow: hidden;
    width: 100%;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 16px;
    background: ${cssVar.colorBgContainer};
  `,
  header: css`
    padding-block: 10px;
    padding-inline: 12px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
  `,
  icon: css`
    color: ${cssVar.colorPrimary};
  `,
  title: css`
    overflow: hidden;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 1;
    font-weight: 500;
    color: ${cssVar.colorText};
  `,
}));

const fieldStyles = createStaticStyles(({ css, cssVar }) => ({
  container: css`
    display: flex;
    flex-direction: column;
    gap: 12px;
  `,
  field: css`
    display: flex;
    flex-direction: column;
    gap: 4px;
  `,
  label: css`
    font-size: 12px;
    font-weight: 500;
    color: ${cssVar.colorTextSecondary};
  `,
  value: css`
    font-size: 13px;
  `,
}));

const batchStyles = createStaticStyles(({ css, cssVar }) => ({
  item: css`
    padding-block: 10px;
    padding-inline: 12px;
    &:not(:last-child) {
      border-block-end: 1px dashed ${cssVar.colorBorderSecondary};
    }
  `,
  index: css`
    flex-shrink: 0;
    font-size: 12px;
    color: ${cssVar.colorTextQuaternary};
  `,
  title: css`
    overflow: hidden;
    font-size: 13px;
    font-weight: 500;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  systemRole: css`
    overflow: hidden;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    font-size: 12px;
    line-height: 1.5;
    color: ${cssVar.colorTextTertiary};
    text-overflow: ellipsis;
  `,
}));

const initPageStyles = createStaticStyles(({ css, cssVar }) => ({
  container: css`
    overflow: hidden;
    width: 100%;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 8px;
    background: ${cssVar.colorBgContainer};
  `,
  header: css`
    padding-block: 10px;
    padding-inline: 12px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
  `,
  icon: css`
    color: ${cssVar.colorPrimary};
  `,
  meta: css`
    color: ${cssVar.colorTextDescription};
  `,
  preview: css`
    max-height: 360px;
    overflow: auto;
    padding-block: 8px;
    padding-inline: 12px;
  `,
  title: css`
    overflow: hidden;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 1;
    font-weight: 500;
    color: ${cssVar.colorText};
  `,
}));

const memoryCardStyles = createStaticStyles(({ css, cssVar }) => ({
  card: css`
    padding: 12px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 8px;
    background: ${cssVar.colorBgContainer};
  `,
  label: css`
    font-size: 12px;
    color: ${cssVar.colorTextSecondary};
  `,
}));

const planStyles = createStaticStyles(({ css, cssVar }) => ({
  container: css`
    overflow: hidden;
    padding: 12px;
    border: 1px solid ${cssVar.colorBorder};
    border-radius: 8px;
  `,
  title: css`
    overflow: hidden;
    font-size: 16px;
    font-weight: 500;
    color: ${cssVar.colorText};
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
}));

const taskCardStyles = createStaticStyles(({ css, cssVar }) => ({
  container: css`
    padding: 12px;
    border-radius: 8px;
    background: ${cssVar.colorFillQuaternary};
  `,
  agentTitle: css`
    font-size: 14px;
    font-weight: 500;
    color: ${cssVar.colorText};
  `,
}));

function extractTitle(markdown: string) {
  const titleLine = markdown
    .split(/\r?\n/)
    .find((line) => line.startsWith('# ') && line.slice(2).trim().length > 0);
  return titleLine?.slice(2).trim();
}

export const UpdatePromptStreaming = memo(function UpdatePromptStreaming({
  args,
}: BuiltinStreamingProps<{ prompt?: string }>) {
  return <MarkdownPromptBlock prompt={args?.prompt} />;
});

export const CreateDocumentStreaming = memo(function CreateDocumentStreaming({
  args,
}: BuiltinStreamingProps<{ content?: string; title?: string }>) {
  const { content, title } = args || {};
  if (!content && !title) return null;
  return (
    <Flexbox className={docCardStyles.container}>
      <Flexbox horizontal align="center" className={docCardStyles.header} gap={8}>
        <FileText className={docCardStyles.icon} size={16} />
        <Flexbox flex={1}>
          <div className={docCardStyles.title}>{title}</div>
        </Flexbox>
        <NeuralNetworkLoading size={20} />
      </Flexbox>
      {!content ? (
        <Flexbox paddingBlock={16} paddingInline={12}>
          <BubblesLoading />
        </Flexbox>
      ) : (
        <StreamingMarkdown>{content}</StreamingMarkdown>
      )}
    </Flexbox>
  );
});

export const CreateAgentStreaming = memo(function CreateAgentStreaming({
  args,
}: BuiltinStreamingProps<{
  description?: string;
  model?: string;
  plugins?: string[];
  provider?: string;
  systemRole?: string;
  title?: string;
}>) {
  const { title, description, systemRole, plugins, model, provider } = args || {};
  if (!title && !description && !systemRole && !plugins?.length) return null;
  return (
    <div className={fieldStyles.container}>
      {title ? (
        <div className={fieldStyles.field}>
          <div className={fieldStyles.label}>Title</div>
          <div className={fieldStyles.value}>{title}</div>
        </div>
      ) : null}
      {description ? (
        <div className={fieldStyles.field}>
          <div className={fieldStyles.label}>Description</div>
          <div className={fieldStyles.value}>{description}</div>
        </div>
      ) : null}
      {(model || provider) ? (
        <div className={fieldStyles.field}>
          <div className={fieldStyles.label}>Model</div>
          <div className={fieldStyles.value}>
            {provider ? `${provider}/` : ''}
            {model}
          </div>
        </div>
      ) : null}
      {plugins?.length ? (
        <div className={fieldStyles.field}>
          <div className={fieldStyles.label}>Plugins</div>
          <Flexbox horizontal gap={4} wrap="wrap">
            {plugins.map((plugin) => (
              <Tag key={plugin}>{plugin}</Tag>
            ))}
          </Flexbox>
        </div>
      ) : null}
      {systemRole ? (
        <div className={fieldStyles.field}>
          <div className={fieldStyles.label}>System Prompt</div>
          <MarkdownPromptBlock prompt={systemRole} />
        </div>
      ) : null}
    </div>
  );
});

export const ExecuteCodeStreaming = memo(function ExecuteCodeStreaming({
  args,
}: BuiltinStreamingProps<{ code?: string; language?: 'javascript' | 'python' | 'typescript' }>) {
  const { code, language = 'python' } = args || {};
  if (!code) return null;
  const displayLanguage =
    language === 'javascript' ? 'JavaScript' : language === 'typescript' ? 'TypeScript' : 'Python';
  return (
    <Highlighter
      animated
      language={displayLanguage}
      showLanguage={false}
      style={{ padding: '4px 8px' }}
      variant="outlined"
      wrap
    >
      {code}
    </Highlighter>
  );
});

export const BatchCreateAgentsStreaming = memo(function BatchCreateAgentsStreaming({
  args,
}: BuiltinStreamingProps<{
  agents?: Array<{
    avatar?: string;
    description?: string;
    systemRole?: string;
    title?: string;
    tools?: string[];
  }>;
}>) {
  const agents = args?.agents;
  if (!agents?.length) return null;
  return (
    <Block variant="outlined" width="100%">
      {agents.map((agent, index) => (
        <Flexbox horizontal align="flex-start" className={batchStyles.item} gap={8} key={index}>
          <div className={batchStyles.index}>{index + 1}.</div>
          <Avatar avatar={agent.avatar} size={24} style={{ flexShrink: 0, marginTop: 4 }} title={agent.title} />
          <Flexbox flex={1} gap={4} style={{ minWidth: 0, overflow: 'hidden' }}>
            <span className={batchStyles.title}>{agent.title}</span>
            {agent.tools?.length ? (
              <Flexbox horizontal gap={4} style={{ marginTop: 8 }} wrap="wrap">
                {agent.tools.map((tool) => (
                  <Tag key={tool}>{tool}</Tag>
                ))}
              </Flexbox>
            ) : null}
            {agent.systemRole ? (
              <div className={batchStyles.systemRole}>
                <Markdown animated variant="chat">
                  {agent.systemRole}
                </Markdown>
              </div>
            ) : null}
          </Flexbox>
        </Flexbox>
      ))}
    </Block>
  );
});

export const UpdateAgentPromptStreaming = memo(function UpdateAgentPromptStreaming({
  args,
}: BuiltinStreamingProps<{ prompt?: string }>) {
  return <MarkdownPromptBlock prompt={args?.prompt} />;
});

export const UpdateGroupPromptStreaming = UpdateAgentPromptStreaming;

export const BroadcastStreaming = memo(function BroadcastStreaming({
  args,
}: BuiltinStreamingProps<{ instruction?: string }>) {
  return <InstructionMarkdown instruction={args?.instruction} />;
});

export const SpeakStreaming = BroadcastStreaming;

export const ExecuteTaskStreaming = memo(function ExecuteTaskStreaming({
  args,
}: BuiltinStreamingProps<{ agentId?: string; agentTitle?: string; instruction?: string }>) {
  const { instruction, agentTitle } = args || {};
  if (!instruction) return null;
  return (
    <div className={taskCardStyles.container}>
      <Flexbox gap={8}>
        <Flexbox horizontal align="center" gap={8}>
          <Avatar shape="square" size={24} />
          <span className={taskCardStyles.agentTitle}>{agentTitle || 'Agent'}</span>
        </Flexbox>
        <Markdown animated variant="chat">
          {instruction}
        </Markdown>
      </Flexbox>
    </div>
  );
});

export const ExecuteTasksStreaming = memo(function ExecuteTasksStreaming({
  args,
}: BuiltinStreamingProps<{
  tasks?: Array<{ agentTitle?: string; instruction?: string }>;
}>) {
  const tasks = args?.tasks;
  if (!tasks?.length) return null;
  return (
    <Flexbox gap={8}>
      {tasks.map((task, index) => (
        <div className={taskCardStyles.container} key={index}>
          <Flexbox gap={8}>
            <Flexbox horizontal align="center" gap={8}>
              <Avatar shape="square" size={20} />
              <span className={taskCardStyles.agentTitle}>{task.agentTitle || `Agent ${index + 1}`}</span>
            </Flexbox>
            {task.instruction ? (
              <Markdown animated variant="chat">
                {task.instruction}
              </Markdown>
            ) : null}
          </Flexbox>
        </div>
      ))}
    </Flexbox>
  );
});

export const CallSubAgentStreaming = memo(function CallSubAgentStreaming({
  args,
}: BuiltinStreamingProps<{ instruction?: string }>) {
  return <InstructionMarkdown instruction={args?.instruction} />;
});

export const CreatePlanStreaming = memo(function CreatePlanStreaming({
  args,
}: BuiltinStreamingProps<{ context?: string; description?: string; goal?: string }>) {
  const { goal, description, context } = args || {};
  if (!goal) return null;
  return (
    <Flexbox className={planStyles.container} gap={8}>
      <Flexbox horizontal align="center" gap={8} style={{ paddingBlock: 4 }}>
        <Icon icon={ListChecks} size={18} />
        <Text ellipsis className={planStyles.title}>
          {goal}
        </Text>
      </Flexbox>
      {description ? (
        <Text ellipsis={{ rows: 2 }} type="secondary">
          {description}
        </Text>
      ) : null}
      <StreamingMarkdown maxHeight={100}>{context}</StreamingMarkdown>
    </Flexbox>
  );
});

export const RunCommandStreaming = memo(function RunCommandStreaming({
  args,
}: BuiltinStreamingProps<{ command?: string }>) {
  return <RunCommandView command={args?.command} />;
});

export const WriteFileStreaming = memo(function WriteFileStreaming({
  args,
}: BuiltinStreamingProps<{ content?: string; path?: string }>) {
  const { content, path: filePath } = args || {};
  if (!content) return null;
  return (
    <FileDiffRender
      kind="create"
      newContent={content}
      padded={false}
      path={filePath || ''}
      variant="outlined"
    />
  );
});

export const EditFileStreaming = memo(function EditFileStreaming({
  args,
}: BuiltinStreamingProps<{
  file_path?: string;
  new_string?: string;
  old_string?: string;
  path?: string;
  search?: string;
  replace?: string;
}>) {
  const { filePath, oldContent, newContent } = resolveEditFileDiff(args);
  if (!oldContent && !newContent) return null;
  return (
    <FileDiffRender
      kind="modify"
      newContent={newContent}
      oldContent={oldContent}
      padded={false}
      path={filePath}
      variant="outlined"
    />
  );
});

export const AddExperienceMemoryStreaming = memo(function AddExperienceMemoryStreaming({
  args,
}: BuiltinStreamingProps<{ details?: string; summary?: string }>) {
  const { summary, details } = args || {};
  if (!summary && !details) return null;
  return (
    <Flexbox className={memoryCardStyles.card} gap={8}>
      <Flexbox horizontal align="center" justify="space-between">
        <Text className={memoryCardStyles.label}>经验记忆</Text>
        {!details ? <BubblesLoading /> : null}
      </Flexbox>
      {summary ? <Text>{summary}</Text> : null}
      {details ? <StreamingMarkdown maxHeight={160}>{details}</StreamingMarkdown> : null}
    </Flexbox>
  );
});

export const AddPreferenceMemoryStreaming = memo(function AddPreferenceMemoryStreaming({
  args,
}: BuiltinStreamingProps<{ preference?: string }>) {
  const { preference } = args || {};
  if (!preference) return null;
  return (
    <Flexbox className={memoryCardStyles.card} gap={8}>
      <Flexbox horizontal align="center" justify="space-between">
        <Text className={memoryCardStyles.label}>偏好记忆</Text>
        <BubblesLoading />
      </Flexbox>
      <StreamingMarkdown maxHeight={120}>{preference}</StreamingMarkdown>
    </Flexbox>
  );
});

export const InitPageStreaming = memo(function InitPageStreaming({
  args,
}: BuiltinStreamingProps<{ markdown?: string }>) {
  const markdown = args?.markdown || '';
  const { chars, lines, preview, title } = useMemo(() => {
    const previewText =
      markdown.length > 4000 ? `${markdown.slice(0, 4000)}\n\n...` : markdown;
    return {
      chars: markdown.length,
      lines: markdown ? markdown.split('\n').length : 0,
      preview: previewText,
      title: extractTitle(markdown),
    };
  }, [markdown]);
  if (!markdown) return null;
  return (
    <Flexbox className={initPageStyles.container}>
      <Flexbox horizontal align="center" className={initPageStyles.header} gap={8}>
        <FileText className={initPageStyles.icon} size={16} />
        <Flexbox flex={1} gap={2}>
          <div className={initPageStyles.title}>{title || '正在创建页面…'}</div>
          <Flexbox horizontal align="center" className={initPageStyles.meta} gap={10}>
            <Text as="span" color={cssVar.colorTextDescription} fontSize={12}>
              <Icon icon={ListTree} size={12} /> <AnimatedNumber value={lines} /> 行
            </Text>
            <Text as="span" color={cssVar.colorTextDescription} fontSize={12}>
              <Icon icon={Hash} size={12} /> <AnimatedNumber value={chars} /> 字符
            </Text>
          </Flexbox>
        </Flexbox>
      </Flexbox>
      <div className={initPageStyles.preview}>
        <StreamingMarkdown maxHeight={360}>{preview}</StreamingMarkdown>
      </div>
    </Flexbox>
  );
});
