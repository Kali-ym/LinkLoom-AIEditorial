import type { Message, StreamImage, Topic, TopicStatus } from '../domain/types';
import type { GroundingData } from '../domain/types/grounding';
import type { ToolPayload } from '../domain/types/tool';
import {
  CHAT_PORTAL_MAX_WIDTH,
  CHAT_PORTAL_TOOL_UI_WIDTH,
  CHAT_PORTAL_WIDTH,
  CHAT_SIDEBAR_WIDTH,
  NAV_PANEL_DEFAULT_WIDTH,
  NAV_PANEL_MAX_WIDTH,
  NAV_PANEL_MIN_WIDTH,
  WORKING_SIDEBAR_DEFAULT_WIDTH,
  WORKING_SIDEBAR_MAX_WIDTH,
  WORKING_SIDEBAR_MIN_WIDTH,
} from '../constants/layoutTokens';

export const COMPACT_VIEWPORT_MAX = 1023;
export const MOBILE_VIEWPORT_MAX = 767;
export const SMALL_VIEWPORT_MAX = 480;
export const PORTAL_MOBILE_MAX = 900;

/** @deprecated Prefer imports from `constants/layoutTokens` */
export const DEFAULT_RIGHT_WIDTH = WORKING_SIDEBAR_DEFAULT_WIDTH;
/** @deprecated Prefer `CHAT_PORTAL_WIDTH` */
export const DEFAULT_PORTAL_WIDTH = CHAT_PORTAL_WIDTH;
export const RIGHT_WIDTH_MIN = WORKING_SIDEBAR_MIN_WIDTH;
export const RIGHT_WIDTH_MAX = WORKING_SIDEBAR_MAX_WIDTH;
export const PORTAL_WIDTH_MIN = CHAT_PORTAL_WIDTH;
export const PORTAL_WIDTH_MAX = CHAT_PORTAL_MAX_WIDTH;
export const PORTAL_TOOL_UI_WIDTH_MIN = CHAT_PORTAL_TOOL_UI_WIDTH;
export const DEFAULT_SIDEBAR_WIDTH = CHAT_SIDEBAR_WIDTH;
export const DEFAULT_NAV_PANEL_WIDTH = NAV_PANEL_DEFAULT_WIDTH;
export { NAV_PANEL_MIN_WIDTH, NAV_PANEL_MAX_WIDTH, CHAT_SIDEBAR_WIDTH, NAV_PANEL_DEFAULT_WIDTH };

export const DEFAULT_TOPIC_ID = 'skills';
export const DEFAULT_CONVERSATION_TITLE = '今天想做什么？';
export const DEFAULT_HOME_CHAT_TITLE = '新话题';

export type RouteView = 'home' | 'conversation';
export type TopicGroupMode = 'flat' | 'byTime' | 'byStatus' | 'byProject';
export type TopicSortBy = 'createdAt' | 'updatedAt';
export type WorkingSidebarTab = 'space' | 'review' | 'files' | 'params';
export type ResourceFilter = 'skills' | 'documents' | 'web';
export type MentionTab = 'recent' | 'agents' | 'topics' | 'skills' | 'tools' | 'files';

export type PortalViewType =
  | 'Home'
  | 'ToolUI'
  | 'Artifact'
  | 'Document'
  | 'Notebook'
  | 'FilePreview'
  | 'LocalFile'
  | 'MessageDetail'
  | 'Thread'
  | 'GroupThread'
  | 'VerifyResult';

export interface PortalFrame {
  type: PortalViewType;
  payload: Record<string, unknown>;
}

export interface TopicThread {
  id: string;
  title: string;
}

export interface InputChip {
  id: string;
  category: string;
  label: string;
  type: string;
  desc?: string;
}

export interface SlashMenuItem {
  kind: 'tag' | 'mention';
  category: string;
  label: string;
  type: string;
  desc?: string;
  badge?: string;
  iconClass?: string;
}

export interface MentionMenuItem {
  id: string;
  name: string;
  description?: string;
  kind: 'agent' | 'tool' | 'recent';
}

export type { QueueItem, QueuedFile } from '../domain/types';

export interface OpTrayState {
  visible: boolean;
  phrase: string;
  elapsedMs: number;
  tokenCount: number;
}

export interface StreamReasoningBlock {
  id: string;
  text: string;
  thinking: boolean;
  open: boolean;
  label: string;
  duration?: string;
  startedAt?: number;
}

export type StreamReasoningSegment = {
  kind: 'reasoning';
  id: string;
  block: StreamReasoningBlock;
};

export type StreamToolSegment = {
  kind: 'tool';
  id: string;
  tool: ToolPayload;
};

export type StreamToolsSegment = {
  kind: 'tools';
  id: string;
  tools: ToolPayload[];
};

export type StreamTextSegment = {
  kind: 'text';
  id: string;
  /** Streaming assistant answer text accumulated in arrival order so it can be
   *  interleaved between reasoning/tool segments instead of collapsing to a
   *  single trailing answer block. */
  text: string;
};

export type StreamTurnSegment =
  | StreamReasoningSegment
  | StreamToolSegment
  | StreamToolsSegment
  | StreamTextSegment;

export interface StreamingMessage {
  id: string;
  role: 'assistant';
  content: string;
  /** @deprecated use segments */
  reasoning?: string;
  /** @deprecated use segments */
  reasoning1?: StreamReasoningBlock;
  /** @deprecated use segments */
  reasoning2?: StreamReasoningBlock;
  segments?: StreamTurnSegment[];
  grounding?: GroundingData;
  /** @deprecated use segments */
  tool?: ToolPayload;
  /** @deprecated use segments */
  tools?: ToolPayload[];
  images?: StreamImage[];
  stopped?: boolean;
  streaming?: boolean;
}

export type ViewportTier = 'mobile' | 'tablet' | 'laptop' | 'desktop';

/** @deprecated Use `Message` from `domain/types` */
export type MockMessage = Message;
/** @deprecated Use `Topic` from `domain/types` */
export type MockTopic = Topic;

export type { Message, StreamImage, Topic, TopicStatus };
