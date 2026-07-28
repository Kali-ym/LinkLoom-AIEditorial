import { GROUNDING_SHOWCASE_IMAGES } from '../../fixtures/showcaseGrounding';
import { buildAdminMockStreamEvents } from '../../fixtures/mockAdminTools';
import { WORKFLOW_SHOWCASE_STREAMING } from '../../fixtures/showcaseTools';
import type { StreamEvent } from '../streaming/streamEvent';
import type { GroundingData } from '../../domain/types/grounding';
import type { ToolPayload } from '../../domain/types/tool';

export type { StreamEvent, StreamEventType } from '../streaming/streamEvent';

export const STATUS_PHRASES = [
  '正在思考…',
  '检索相关信息…',
  '调用工具中…',
  '组织回答…',
  '生成正文…',
] as const;

export interface StreamState {
  reasoning1: string;
  reasoning2: string;
  content: string;
  grounding?: GroundingData;
  tools: ToolPayload[];
}

export interface SendStopModeState {
  isStreaming: boolean;
  title: string;
}

export function getSendStopMode(isStreaming: boolean): SendStopModeState {
  return {
    isStreaming,
    title: isStreaming ? '停止生成' : '发送',
  };
}

function chunkText(text: string, size: number): string[] {
  const parts: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    parts.push(text.slice(i, i + size));
  }
  return parts.length ? parts : [text];
}

/** Event sequence aligned with index.html buildEventSequence + processNext timing. */
export function buildEventSequence(
  userText: string,
  options?: { agentId?: string },
): StreamEvent[] {
  const trimmed = userText.trim();
  const hasUrl = /https?:\/\//i.test(trimmed);
  const isSimple = /^(你好|hello|hi|嗨)[!！?？。]*$/i.test(trimmed) && !hasUrl;

  if (isSimple) {
    const greetReasoning = '用户发来问候，直接以友好语气回应即可，无需调用工具。';
    const greetContent =
      '你好！我是 **收件箱助手**。你可以向我提问、创建任务，或使用 `@` 将任务分配给其他智能体。';
    const events: StreamEvent[] = [];
    chunkText(greetReasoning, 6).forEach((c) => {
      events.push({ type: 'reasoning_part', content: c, block: 1 });
    });
    events.push({ type: 'reasoning', block: 1 });
    chunkText(greetContent, 4).forEach((c) => {
      events.push({ type: 'content_part', content: c });
    });
    events.push({ type: 'stop' });
    return events;
  }

  if (options?.agentId === 'super_admin') {
    const adminEvents = buildAdminMockStreamEvents(trimmed);
    if (adminEvents) return adminEvents;
  }

  const reasoning1 = hasUrl
    ? '用户提供了链接，需要先理解意图，再抓取页面内容组织回答。'
    : `分析用户问题：「${trimmed}」。检索相关文档后组织结构化回答。`;
  const reasoning2 = hasUrl
    ? '页面内容已获取，现在结合用户问题组织回答，突出 Changelog 要点与可用技能。'
    : '信息已整理完毕，现在组织结构化回答。';
  const content = hasUrl
    ? '## UI 更新日志 概览\n\n根据页面内容，**@lobehub/ui v5.x** 近期主要更新包括：\n\n- **ThemeProvider** — 支持 cssVar key 自定义\n- **Accordion / ScrollArea** — 用于 Reasoning 与 Workflow 折叠面板\n- **DraggablePanel** — 右侧工作面板可拖拽调宽\n\n我的可用技能包括：网页读取、代码分析、RSS 聚合、任务规划与多 Agent 协作。'
    : `针对「${trimmed}」：LinkLoom 可通过 **studio/** 包接入 @lobehub/ui，用 Zustand 管理状态，通过 SSE 对接 backend 的 \`AgentService.streamAgent\`。`;

  const events: StreamEvent[] = [];

  const wantsImageGrounding = /图片|image|生成图|screenshot/i.test(trimmed);
  const wantsWorkflow = /多工具|workflow/i.test(trimmed);

  chunkText(reasoning1, 8).forEach((c) => {
    events.push({ type: 'reasoning_part', content: c, block: 1 });
  });

  if (wantsImageGrounding && !hasUrl) {
    events.push({
      type: 'grounding',
      data: {
        imageSearchQueries: GROUNDING_SHOWCASE_IMAGES.imageSearchQueries,
        imageResults: GROUNDING_SHOWCASE_IMAGES.imageResults,
      },
    });
  }

  if (hasUrl) {
    events.push({
      type: 'grounding',
      data: {
        searchQueries: ['UI changelog', '@lobehub/ui components'],
        citations: [
          {
            favicon: 'docs.example.com',
            title: '@lobehub/ui Changelog',
            url: 'https://docs.example.com/changelog',
          },
          {
            favicon: 'github.com',
            title: 'example/ui-lib — React component library',
            url: 'https://github.com/example/ui-lib',
          },
          {
            favicon: 'example.com',
            title: 'Agent 框架',
            url: 'https://example.com',
          },
        ],
      },
    });
    events.push({
      type: 'tool_calls',
      tools: [
        {
          plugin: 'web-browsing',
          api: 'fetchPage',
          url: trimmed.match(/https?:\/\/\S+/)?.[0] ?? 'https://docs.example.com/changelog',
          state: 'executing',
        },
      ],
    });
  }

  if (wantsWorkflow && !hasUrl) {
    events.push({ type: 'tool_calls', tools: WORKFLOW_SHOWCASE_STREAMING.tools });
    chunkText(reasoning2, 10).forEach((c) => {
      events.push({ type: 'reasoning_part', content: c, block: 2 });
    });
    events.push({
      type: 'tool_calls',
      tools: [
        { ...WORKFLOW_SHOWCASE_STREAMING.tools[0] },
        { ...WORKFLOW_SHOWCASE_STREAMING.tools[1], state: 'success', duration: '1.1' },
        { ...WORKFLOW_SHOWCASE_STREAMING.tools[2], state: 'executing' },
      ],
    });
    events.push({
      type: 'tool_calls',
      tools: WORKFLOW_SHOWCASE_STREAMING.tools.map((t) =>
        t.state === 'pending' ? { ...t, state: 'success' as const, duration: '0.5', resultText: '文档已更新。' }
          : t.state === 'executing' ? { ...t, state: 'success' as const, duration: '1.1', resultText: '命令执行成功。' }
            : t,
      ),
    });
  } else {
    chunkText(reasoning2, 10).forEach((c) => {
      events.push({ type: 'reasoning_part', content: c, block: 2 });
    });

    if (hasUrl) {
      events.push({
        type: 'tool_calls',
        tools: [
          {
            plugin: 'web-browsing',
            api: 'fetchPage',
            url: trimmed.match(/https?:\/\/\S+/)?.[0] ?? 'https://docs.example.com/changelog',
            state: 'success',
            duration: '1.2',
          },
        ],
      });
    }
  }

  chunkText(content, 6).forEach((c) => {
    events.push({ type: 'content_part', content: c });
  });

  if (/图片|image|生成图/i.test(trimmed)) {
    events.push({
      type: 'base64_image',
      alt: '生成图片',
    });
  }

  events.push({ type: 'stop' });
  return events;
}

function delayForEvent(event: StreamEvent): number {
  switch (event.type) {
    case 'stop':
      return 80;
    case 'reasoning':
      return 12;
    case 'reasoning_part':
      return 28;
    case 'grounding':
      return 400;
    case 'tool_calls':
      return event.tools?.[0]?.state === 'executing' ? 900 : 300;
    case 'content_part':
      return 22;
    case 'text':
      return 22;
    case 'base64_image':
      return 300;
    default:
      return 180;
  }
}

export async function runStreamingHandler(
  userText: string,
  handlers: {
    onEvent: (event: StreamEvent) => void;
    signal?: AbortSignal;
  },
  options?: { agentId?: string },
): Promise<void> {
  const events = buildEventSequence(userText, options);
  for (const event of events) {
    if (handlers.signal?.aborted) break;
    handlers.onEvent(event);
    await new Promise((r) => window.setTimeout(r, delayForEvent(event)));
  }
}

export function applyStreamEvent(state: StreamState, event: StreamEvent): StreamState {
  const next = { ...state, tools: [...state.tools] };
  switch (event.type) {
    case 'reasoning_part':
      if (event.block === 2) next.reasoning2 += event.content ?? '';
      else next.reasoning1 += event.content ?? '';
      break;
    case 'grounding':
      if (event.data && !('runId' in event.data) && !('fallback' in event.data)) {
        next.grounding = event.data;
      }
      break;
    case 'tool_calls':
      if (event.tools?.length) next.tools = event.tools;
      break;
    case 'content_part':
      next.content += event.text ?? event.content ?? '';
      break;
    case 'text':
      next.content += event.text ?? event.content ?? '';
      break;
    default:
      break;
  }
  return next;
}
