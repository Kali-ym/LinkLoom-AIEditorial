import { Avatar, Block, Flexbox, Highlighter, Icon, Markdown, PatchDiff, Tag, Text } from '@lobehub/ui';
import { cssVar } from 'antd-style';
import { Bot, CheckCircle2, FileText, Globe, ListTree, Search, XCircle } from 'lucide-react';
import { memo } from 'react';


import type { BuiltinRenderProps } from '../../toolComponentTypes';
import { inferLanguage } from '../../../../../../utils/fileTree';
import { InstructionMarkdown, MarkdownPromptBlock } from '../../Streaming/shared';
import { parsePluginJson } from './localSystemRenders';
import { RunCommandRender } from './runCommandRender';
import { TodoWriteRender } from './claudeCodeRenders';
import { TodoPanel, normalizeTodoPanelItems, parseTodoUpdates, enrichTodoUpdates, readTodoUpdateSummary } from './TodoPanel';
import { TodoUpdatePanel } from './TodoUpdatePanel';
import { ToolArgsPreview } from '../../shared/ToolArgsPreview';
import { FileDiffRender } from '../../shared/FileDiffRender';
import { toolRenderStyles } from '../../shared/toolRenderStyles';

function pickText(content?: string | null, pluginState?: unknown, ...keys: string[]): string {
  for (const key of keys) {
    const fromArgs = (pluginState as Record<string, unknown> | undefined)?.[key];
    if (typeof fromArgs === 'string' && fromArgs.trim()) return fromArgs;
  }
  return content?.trim() || '';
}

export const MarkdownResultRender = memo(function MarkdownResultRender({
  content,
  pluginState,
}: BuiltinRenderProps) {
  const text = pickText(content, pluginState, 'content', 'text', 'message', 'instruction', 'prompt');
  if (!text) return null;
  return <Markdown variant="chat">{text}</Markdown>;
});

export const DocumentCardRender = memo(function DocumentCardRender({
  args,
  content,
  pluginState,
}: BuiltinRenderProps<{ title?: string; content?: string; documentId?: string }>) {
  const ps = parsePluginJson<{ document?: { title?: string; content?: string; id?: string } }>(content, pluginState);
  const title = args?.title || ps?.document?.title || '文档';
  const body = args?.content || ps?.document?.content || content || '';
  const id = args?.documentId || ps?.document?.id;
  return (
    <Block className={toolRenderStyles.panel} padding={12} variant="borderless" width="100%">
      <Flexbox gap={8}>
        <Flexbox horizontal align="center" gap={8}>
          <Icon icon={FileText} size={16} />
          <Text strong>{title}</Text>
          {id ? <Tag>{id}</Tag> : null}
        </Flexbox>
        {body ? <Markdown style={{ maxHeight: 240, overflow: 'auto' }} variant="chat">{body}</Markdown> : null}
      </Flexbox>
    </Block>
  );
});

export const AgentCardRender = memo(function AgentCardRender({
  args,
  content,
  pluginState,
}: BuiltinRenderProps<{ agentId?: string; title?: string; name?: string }>) {
  const ps = parsePluginJson<{ agents?: { id?: string; title?: string }[] }>(content, pluginState);
  const agents = ps?.agents;
  if (agents?.length) {
    return (
      <Block className={toolRenderStyles.panel} variant="borderless" width="100%">
        {agents.map((agent, i) => (
          <Flexbox horizontal align="center" className={toolRenderStyles.row} gap={8} key={agent.id || i}>
            <Avatar avatar={<Icon icon={Bot} size={16} />} size={28} />
            <Text>{agent.title || agent.id}</Text>
          </Flexbox>
        ))}
      </Block>
    );
  }
  const name = args?.title || args?.name || args?.agentId || content?.slice(0, 80);
  if (!name) return null;
  return (
    <Flexbox horizontal align="center" className={toolRenderStyles.row} gap={8}>
      <Avatar avatar={<Icon icon={Bot} size={16} />} size={28} />
      <Text>{name}</Text>
    </Flexbox>
  );
});

export const PlanCardRender = memo(function PlanCardRender({
  args,
  content,
  pluginState,
}: BuiltinRenderProps<{ goal?: string; context?: string }>) {
  const ps = parsePluginJson<{ goal?: string; context?: string }>(content, pluginState);
  const goal = args?.goal || ps?.goal;
  const context = args?.context || ps?.context || content;
  return (
    <Block className={toolRenderStyles.panel} variant="borderless" width="100%">
      <div className={toolRenderStyles.panelHeader}>
        <Icon icon={ListTree} size={16} style={{ color: cssVar.colorPrimary, flexShrink: 0 }} />
        <span className={toolRenderStyles.panelHeaderTitle}>{goal || '执行计划'}</span>
      </div>
      {context ? (
        <div className={toolRenderStyles.bodyPad}>
          <Markdown variant="chat">{context}</Markdown>
        </div>
      ) : null}
    </Block>
  );
});

export const TodoListRender = memo(function TodoListRender({
  args,
  content,
  pluginState,
}: BuiltinRenderProps<{ items?: { status?: string; text?: string }[]; todos?: { content?: string; completed?: boolean }[]; adds?: string[] }>) {
  const todos = normalizeTodoPanelItems(
    args as Record<string, unknown> | undefined,
    pluginState,
    content ?? undefined,
  );
  if (todos?.length) return <TodoPanel todos={todos} />;

  try {
    const fallbackArgs = args ? JSON.stringify(args, null, 2) : undefined;
    return <ToolArgsPreview arguments={fallbackArgs} title="待办参数" />;
  } catch {
    return (
      <Block className={toolRenderStyles.panel} padding={12} variant="borderless" width="100%">
        <span className={toolRenderStyles.panelHeaderTitle}>暂无待办条目</span>
      </Block>
    );
  }
});

export const UpdateTodosRender = memo(function UpdateTodosRender({
  args,
  content,
  pluginState,
}: BuiltinRenderProps<{
  replace?: boolean;
  todos?: { content?: string; completed?: boolean; id?: string }[];
  updates?: { id?: string; content?: string; completed?: boolean }[];
}>) {
  const parsedArgs = args as Record<string, unknown> | undefined;
  const updates = parseTodoUpdates(parsedArgs);
  const resultTodos = normalizeTodoPanelItems(undefined, pluginState, content ?? undefined);
  const summary = readTodoUpdateSummary(pluginState, content ?? undefined);

  if (updates?.length) {
    return (
      <TodoUpdatePanel
        resultTodos={resultTodos}
        summary={summary}
        updates={enrichTodoUpdates(updates, pluginState, content ?? undefined, resultTodos)}
      />
    );
  }

  const todos = normalizeTodoPanelItems(parsedArgs, pluginState, content ?? undefined);
  if (todos?.length) return <TodoPanel todos={todos} />;

  try {
    const fallbackArgs = args ? JSON.stringify(args, null, 2) : undefined;
    return <ToolArgsPreview arguments={fallbackArgs} title="待办更新" />;
  } catch {
    return (
      <Block className={toolRenderStyles.panel} padding={12} variant="borderless" width="100%">
        <span className={toolRenderStyles.panelHeaderTitle}>暂无待办变更</span>
      </Block>
    );
  }
});

export const SearchListRender = memo(function SearchListRender({
  args,
  content,
  pluginState,
}: BuiltinRenderProps<{ query?: string }, { results?: { title?: string; name?: string; id?: string }[] }>) {
  const query = args?.query;
  const results = parsePluginJson<{ results?: { title?: string; name?: string; id?: string }[] }>(content, pluginState)?.results;
  return (
    <Flexbox gap={8}>
      {query ? (
        <Flexbox horizontal align="center" gap={6}>
          <Icon icon={Search} size={14} />
          <Text>{query}</Text>
        </Flexbox>
      ) : null}
      {results?.length ? (
        <Block className={toolRenderStyles.panel} variant="borderless" width="100%">
          {results.map((item, i) => (
            <div className={toolRenderStyles.row} key={item.id || i}>
              <Text>{item.title || item.name || item.id}</Text>
            </div>
          ))}
        </Block>
      ) : content ? (
        <Markdown variant="chat">{content}</Markdown>
      ) : null}
    </Flexbox>
  );
});

export const ChipListRender = memo(function ChipListRender({
  content,
  pluginState,
}: BuiltinRenderProps<Record<string, unknown>, { items?: string[]; tags?: string[] }>) {
  const ps = parsePluginJson<{ items?: string[]; tags?: string[] }>(content, pluginState);
  const items = ps?.items || ps?.tags || content?.split('\n').filter(Boolean);
  if (!items?.length) return null;
  return (
    <Flexbox gap={6} horizontal wrap="wrap">
      {items.map((item: string) => (
        <span className={toolRenderStyles.chip} key={item}>
          {item}
        </span>
      ))}
    </Flexbox>
  );
});

export const TaskCardRender = memo(function TaskCardRender({
  args,
  content,
  pluginState,
}: BuiltinRenderProps<{ title?: string; description?: string }>) {
  const ps = parsePluginJson<{ title?: string; description?: string }>(content, pluginState);
  const title = args?.title || ps?.title;
  const description = args?.description || ps?.description || content;
  return (
    <Block className={toolRenderStyles.panel} padding={12} variant="borderless" width="100%">
      <Flexbox gap={6}>
        {title ? <Text strong>{title}</Text> : null}
        {description ? <Text type="secondary">{description}</Text> : null}
      </Flexbox>
    </Block>
  );
});

export const TaskListRender = memo(function TaskListRender({
  content,
  pluginState,
}: BuiltinRenderProps) {
  const ps = parsePluginJson<{ tasks?: { title?: string; status?: string }[] }>(content, pluginState);
  const tasks = ps?.tasks;
  if (!tasks?.length && content) return <Markdown variant="chat">{content}</Markdown>;
  return (
    <Block className={toolRenderStyles.panel} variant="borderless" width="100%">
      {tasks?.map((task, i) => (
        <Flexbox horizontal align="center" className={toolRenderStyles.row} gap={8} key={i}>
          <Text style={{ flex: 1 }}>{task.title}</Text>
          {task.status ? <Tag>{task.status}</Tag> : null}
        </Flexbox>
      ))}
    </Block>
  );
});

export const RunTasksResultRender = memo(function RunTasksResultRender({
  content,
  pluginState,
}: BuiltinRenderProps) {
  const ps = parsePluginJson<{ results?: { title?: string; success?: boolean }[] }>(content, pluginState);
  const results = ps?.results;
  if (!results?.length) return content ? <Markdown variant="chat">{content}</Markdown> : null;
  return (
    <Block className={toolRenderStyles.panel} variant="borderless" width="100%">
      {results.map((item, i) => (
        <Flexbox horizontal align="center" className={toolRenderStyles.row} gap={8} key={i}>
          <Icon icon={item.success ? CheckCircle2 : XCircle} size={16} style={{ color: item.success ? cssVar.colorSuccess : cssVar.colorError }} />
          <Text>{item.title}</Text>
        </Flexbox>
      ))}
    </Block>
  );
});

export const DeviceCardRender = memo(function DeviceCardRender({
  args,
  content,
  pluginState,
}: BuiltinRenderProps<{ name?: string; deviceId?: string }>) {
  const ps = parsePluginJson<{ devices?: { name?: string; id?: string }[]; error?: string }>(content, pluginState);
  if (ps?.error) return <Text type="danger">{ps.error}</Text>;
  const devices = ps?.devices;
  if (devices?.length) {
    return (
      <Block className={toolRenderStyles.panel} variant="borderless" width="100%">
        {devices.map((d, i) => (
          <div className={toolRenderStyles.row} key={d.id || i}>{d.name || d.id}</div>
        ))}
      </Block>
    );
  }
  const name = args?.name || args?.deviceId || content;
  return name ? <Text>{name}</Text> : null;
});

export const MemoryCardRender = memo(function MemoryCardRender({
  args,
  content,
  pluginState,
}: BuiltinRenderProps<{ title?: string; content?: string; type?: string }>) {
  const ps = parsePluginJson<{ title?: string; content?: string; memories?: { title?: string; content?: string }[] }>(content, pluginState);
  const memories = ps?.memories;
  if (memories?.length) {
    return (
      <Block className={toolRenderStyles.panel} variant="borderless" width="100%">
        {memories.map((m, i) => (
          <Flexbox className={toolRenderStyles.row} gap={6} key={i}>
            <Text strong>{m.title || `记忆 ${i + 1}`}</Text>
            {m.content ? <Markdown variant="chat">{m.content}</Markdown> : null}
          </Flexbox>
        ))}
      </Block>
    );
  }
  const title = args?.title || ps?.title;
  const body = args?.content || ps?.content || content;
  return (
    <Block className={toolRenderStyles.panel} padding={12} variant="borderless" width="100%">
      <Flexbox gap={6}>
        {title ? <Text strong>{title}</Text> : null}
        {body ? <Markdown variant="chat">{body}</Markdown> : null}
      </Flexbox>
    </Block>
  );
});

export const WebPageCardsRender = memo(function WebPageCardsRender({
  args,
  content,
  pluginState,
}: BuiltinRenderProps<{ url?: string; title?: string }>) {
  const ps = parsePluginJson<{ pages?: { url?: string; title?: string }[] }>(content, pluginState);
  const pages = ps?.pages || (args?.url ? [{ url: args.url, title: args.title }] : undefined);
  if (!pages?.length) return content ? <Markdown variant="chat">{content}</Markdown> : null;
  return (
    <Flexbox gap={8} horizontal style={{ overflowX: 'auto' }}>
      {pages.map((page, i) => (
        <Block className={toolRenderStyles.panel} key={page.url || i} padding={12} style={{ minWidth: 180 }} variant="borderless">
          <Flexbox gap={6}>
            <Icon icon={Globe} size={16} />
            <Text ellipsis strong>{page.title || page.url}</Text>
          </Flexbox>
        </Block>
      ))}
    </Flexbox>
  );
});

export const ModifyNodesRender = memo(function ModifyNodesRender({
  content,
  pluginState,
}: BuiltinRenderProps) {
  const ps = parsePluginJson<{ changes?: { action?: string; position?: string; content?: string; success?: boolean }[] }>(content, pluginState);
  const changes = ps?.changes;
  if (!changes?.length) return content ? <Highlighter language="json" variant="borderless" wrap>{content}</Highlighter> : null;
  return (
    <Block className={toolRenderStyles.panel} variant="borderless" width="100%">
      {changes.map((change, i) => (
        <Flexbox className={toolRenderStyles.row} gap={4} key={i}>
          <Tag>{change.action}</Tag>
          {change.position ? <Text type="secondary">{change.position}</Text> : null}
          {change.content ? <Text ellipsis>{change.content}</Text> : null}
          {change.success != null ? <Tag color={change.success ? 'green' : 'red'}>{change.success ? '成功' : '失败'}</Tag> : null}
        </Flexbox>
      ))}
    </Block>
  );
});

export const GenerateVerifyPlanRender = memo(function GenerateVerifyPlanRender({
  content,
  pluginState,
}: BuiltinRenderProps) {
  const ps = parsePluginJson<{ criteria?: { name?: string; required?: boolean }[]; standard?: string }>(content, pluginState);
  return (
    <Block className={toolRenderStyles.panel} padding={12} variant="borderless" width="100%">
      <Flexbox gap={10}>
        {ps?.standard ? <Text strong>{ps.standard}</Text> : null}
        {ps?.criteria?.map((c, i) => (
          <Flexbox horizontal align="center" gap={8} key={i}>
            <Icon icon={c.required ? CheckCircle2 : Bot} size={14} />
            <Text>{c.name}</Text>
            {c.required ? <Tag>必需</Tag> : null}
          </Flexbox>
        )) || (content ? <Markdown variant="chat">{content}</Markdown> : null)}
      </Flexbox>
    </Block>
  );
});

export const CodeDiffPatchRender = memo(function CodeDiffPatchRender({
  args,
  content,
}: BuiltinRenderProps<{ old_string?: string; new_string?: string }>) {
  const oldStr = args?.old_string || '';
  const newStr = args?.new_string || content || '';
  if (!oldStr && !newStr) return null;
  return <FileDiffRender kind="modify" maxHeight={280} newContent={newStr} oldContent={oldStr} padded={false} />;
});

export const SkillActivateRender = memo(function SkillActivateRender({
  args,
  content,
}: BuiltinRenderProps<{ skill?: string; name?: string; description?: string }>) {
  const name = args?.skill || args?.name || 'Skill';
  const description = args?.description;
  const body = content?.trim();
  return (
    <Flexbox gap={8}>
      <Text strong>{name}</Text>
      {description ? <Text type="secondary">{description}</Text> : null}
      {body ? <Markdown variant="chat">{body}</Markdown> : null}
    </Flexbox>
  );
});

export const ImportStatusRender = memo(function ImportStatusRender({
  args,
  content,
  pluginState,
}: BuiltinRenderProps<{ skill?: string; name?: string }, { status?: string }>) {
  const ps = parsePluginJson<{ status?: string; name?: string }>(content, pluginState);
  const name = args?.skill || args?.name || ps?.name;
  return (
    <Flexbox horizontal align="center" gap={8}>
      {ps?.status ? <Tag>{ps.status}</Tag> : null}
      {name ? <Text>{name}</Text> : null}
      {!name && !ps?.status && content ? <Markdown variant="chat">{content}</Markdown> : null}
    </Flexbox>
  );
});

export const ExecScriptRender = RunCommandRender;

export const ReadReferenceRender = memo(function ReadReferenceRender({
  args,
  content,
}: BuiltinRenderProps<{ path?: string; file_path?: string }>) {
  const path = args?.path || args?.file_path;
  const body = content?.trim();
  if (!body) return path ? <Text type="secondary">{path}</Text> : null;
  return (
    <Flexbox gap={6}>
      {path ? <Text type="secondary">{path}</Text> : null}
      <Highlighter language="text" showLanguage={false} style={{ maxHeight: 240, overflow: 'auto' }} variant="borderless" wrap>
        {body}
      </Highlighter>
    </Flexbox>
  );
});

export const CollabToolRender = memo(function CollabToolRender({
  args,
  content,
}: BuiltinRenderProps<{ instruction?: string; prompt?: string }>) {
  const instruction = args?.instruction || args?.prompt || content;
  return instruction ? <InstructionMarkdown instruction={instruction} /> : null;
});

export const FileChangeRender = memo(function FileChangeRender({
  content,
  pluginState,
}: BuiltinRenderProps) {
  const ps = parsePluginJson<{ files?: { path?: string; patch?: string }[] }>(content, pluginState);
  const files = ps?.files;
  if (!files?.length) return content ? <Markdown variant="chat">{content}</Markdown> : null;
  return (
    <Block className={toolRenderStyles.panel} variant="borderless" width="100%">
      {files.map((file, i) => (
        <Flexbox className={toolRenderStyles.row} gap={6} key={file.path || i}>
          <Text strong>{file.path}</Text>
          {file.patch ? (
            <PatchDiff
              fileName={file.path}
              language={file.path ? inferLanguage(file.path) : 'text'}
              patch={file.patch}
              showHeader={false}
              variant="borderless"
              viewMode="unified"
            />
          ) : null}
        </Flexbox>
      ))}
    </Block>
  );
});

export const McpToolRender = memo(function McpToolRender({ content }: BuiltinRenderProps) {
  if (!content?.trim()) return null;
  return (
    <Highlighter language="json" showLanguage={false} style={{ maxHeight: 280, overflow: 'auto' }} variant="borderless" wrap>
      {content}
    </Highlighter>
  );
});

export const CodexWebSearchRender = SearchListRender;

export const CodexTodoListRender = TodoWriteRender;

export const GithubRunCommandRender = RunCommandRender;

export const CallAgentRender = memo(function CallAgentRender(props: BuiltinRenderProps<{ instruction?: string }>) {
  const instruction = props.args?.instruction || props.content;
  return instruction ? <InstructionMarkdown instruction={instruction} /> : null;
});

export const UpdatePromptRender = memo(function UpdatePromptRender({
  args,
  content,
}: BuiltinRenderProps<{ prompt?: string }>) {
  const prompt = args?.prompt || content;
  return prompt ? <MarkdownPromptBlock prompt={prompt} /> : null;
});

export const BroadcastRender = memo(function BroadcastRender(props: BuiltinRenderProps<{ message?: string }>) {
  return <MarkdownResultRender {...props} />;
});

export const SpeakRender = BroadcastRender;

export const ExecuteTaskRender = TaskCardRender;

export const ExecuteTasksRender = TaskListRender;

export const KnowledgeFileRender = memo(function KnowledgeFileRender({
  content,
  pluginState,
}: BuiltinRenderProps) {
  const ps = parsePluginJson<{ files?: { name?: string }[] }>(content, pluginState);
  const files = ps?.files;
  if (!files?.length) return content ? <Markdown variant="chat">{content}</Markdown> : null;
  return (
    <Flexbox gap={8} horizontal style={{ overflowX: 'auto' }}>
      {files.map((f, i) => (
        <Block className={toolRenderStyles.panel} key={f.name || i} padding={10} style={{ minWidth: 140 }} variant="borderless">
          <Flexbox horizontal align="center" gap={6}>
            <Icon icon={FileText} size={14} />
            <Text ellipsis>{f.name}</Text>
          </Flexbox>
        </Block>
      ))}
    </Flexbox>
  );
});

export const SaveUserQuestionRender = memo(function SaveUserQuestionRender({
  content,
  pluginState,
}: BuiltinRenderProps) {
  const ps = parsePluginJson<{ identity?: string; interests?: string[] }>(content, pluginState);
  return (
    <Flexbox gap={8}>
      {ps?.identity ? <Text strong>{ps.identity}</Text> : null}
      {ps?.interests?.length ? (
        <Flexbox gap={6} horizontal wrap="wrap">
          {ps.interests.map((item) => (
            <span className={toolRenderStyles.chip} key={item}>
              {item}
            </span>
          ))}
        </Flexbox>
      ) : null}
      {!ps?.identity && !ps?.interests?.length && content ? <Markdown variant="chat">{content}</Markdown> : null}
    </Flexbox>
  );
});

export const SubmitAgentPickRender = memo(function SubmitAgentPickRender({
  content,
  pluginState,
}: BuiltinRenderProps) {
  const ps = parsePluginJson<{ summaries?: { title?: string }[]; installedAgentIds?: string[] }>(content, pluginState);
  const agents = ps?.summaries;
  if (!agents?.length) return content ? <Markdown variant="chat">{content}</Markdown> : null;
  return (
    <Flexbox gap={8} horizontal wrap="wrap">
      {agents.map((agent, i) => (
        <Block className={toolRenderStyles.panel} key={i} padding={10} style={{ minWidth: 120 }} variant="borderless">
          <Text>{agent.title}</Text>
        </Block>
      ))}
    </Flexbox>
  );
});

export const GetAvailableModelsRender = SearchListRender;
export const SearchMarketToolsRender = SearchListRender;
export const InstallPluginRender = ImportStatusRender;
export const UpdateConfigRender = CodeDiffPatchRender;

export const CreateAgentRender = AgentCardRender;
export const DuplicateAgentRender = AgentCardRender;
export const GetAgentDetailRender = AgentCardRender;
export const SearchAgentRender = SearchListRender;
export const UpdateAgentRender = AgentCardRender;

export const BatchCreateAgentsRender = AgentCardRender;
export const UpdateAgentPromptRender = UpdatePromptRender;
export const UpdateGroupPromptRender = UpdatePromptRender;

export const CallSubAgentRender = CallAgentRender;
export const CreatePlanRender = PlanCardRender;

export const ActivateSkillRender = SkillActivateRender;
