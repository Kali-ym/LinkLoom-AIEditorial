import type { GroundingData } from './grounding';
import type { ToolPayload } from './tool';

export interface UserLinkLine {
  url: string;
  label?: string;
}

export interface UserLinkCard {
  url: string;
  title: string;
  host: string;
  letter?: string;
}

export interface StaticReasoningBlock {
  id: string;
  label: string;
  duration: string;
  thinking: boolean;
  open: boolean;
  paragraphs: string[];
}

export interface StaticUserMessage {
  id: string;
  time: string;
  text?: string;
  linkLine?: UserLinkLine;
  linkCard?: UserLinkCard;
}

export interface StaticAssistantMessage {
  id: string;
  agentName: string;
  time: string;
  grounding: GroundingData;
  reasoningBeforeTool: StaticReasoningBlock;
  tool: ToolPayload & {
    args: Record<string, unknown>;
    resultText: string;
    debug: string;
  };
  reasoningAfterTool: StaticReasoningBlock;
  markdown: {
    title: string;
    intro: string;
    bullets: Array<{ term: string; detail: string }>;
    footer: string;
  };
}

export interface StaticConversation {
  topicTitle: string;
  prelude: Array<{
    user: StaticUserMessage;
    assistant: {
      agentName?: string;
      time: string;
      content: string;
      codeBlock?: boolean;
    };
  }>;
  user: StaticUserMessage;
  assistant: {
    id: string;
    agentName: string;
    time: string;
    grounding: GroundingData;
    reasoningBeforeTool: StaticReasoningBlock;
    tool: ToolPayload & {
      args: Record<string, unknown>;
      resultText: string;
      debug: string;
    };
    reasoningAfterTool: StaticReasoningBlock;
    markdown: {
      title: string;
      intro: string;
      bullets: Array<{ term: string; detail: string }>;
      footer: string;
    };
  };
  followUpUser: StaticUserMessage;
  followUpAssistant: {
    agentName: string;
    time: string;
    content: string;
  };
}
