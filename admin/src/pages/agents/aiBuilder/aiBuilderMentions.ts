import type {
  Agent,
  AiBuildTarget,
  AiBuilderMention,
  Skill,
  Workflow
} from '../../../services/agentService';
import { formatJson } from '../../../utils/jsonField';
import type { AiBuilderSession } from './sessionStorage';

export function targetLabel(target?: AiBuildTarget) {
  if (target === 'agent') return '智能体';
  if (target === 'skill') return '技能';
  if (target === 'workflow') return '工作流';
  return '资源';
}

export function mentionIcon(mention: AiBuilderMention) {
  const target = mention.type === 'create' ? mention.target : mention.type;
  if (target === 'agent') return 'smart_toy';
  if (target === 'skill') return 'bolt';
  return 'account_tree';
}

function nowId() {
  return `builder_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function defaultTitle(mention?: AiBuilderMention) {
  if (!mention) return '新的 Builder 会话';
  if (mention.type === 'create') return `创建 ${targetLabel(mention.target)}`;
  return `修改 ${mention.label}`;
}

export function createSession(
  defaultProviderId: string,
  defaultModel: string,
  mention?: AiBuilderMention
): AiBuilderSession {
  const now = Date.now();
  return {
    id: nowId(),
    title: defaultTitle(mention),
    messages: [],
    mentions: mention ? [mention] : [],
    draft: '',
    draftMentions: mention ? [mention] : [],
    plan: null,
    activeDraft: null,
    builderMode: 'chat',
    planAnswers: {},
    contextSummary: '',
    checkpoints: [],
    providerId: defaultProviderId,
    model: defaultModel,
    createdAt: now,
    updatedAt: now
  };
}

export function mentionKey(mention: AiBuilderMention) {
  return `${mention.type}:${mention.target || ''}:${mention.id || ''}:${mention.label}`;
}

export function uniqueMentions(mentions: AiBuilderMention[]) {
  const seen = new Set<string>();
  return mentions.filter((mention) => {
    const key = mentionKey(mention);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function mentionText(mention: AiBuilderMention) {
  if (mention.type === 'create') return `@创建 ${targetLabel(mention.target)}`;
  return `@${mention.label}`;
}

export function estimateTokens(session: AiBuilderSession) {
  const text = [
    session.contextSummary || '',
    session.contextMemory ? formatJson(session.contextMemory) : '',
    ...session.messages.map((message) => message.content),
    ...session.messages.map((message) => (message.questions ? formatJson(message.questions) : '')),
    ...session.messages.map((message) =>
      message.planSnapshot
        ? `${message.planSnapshot.id} ${message.planSnapshot.version || 1} ${message.planSnapshot.summary}`
        : ''
    )
  ].join('\n');
  return Math.ceil(
    Array.from(text).reduce((total, char) => total + (char.charCodeAt(0) > 255 ? 1 : 0.35), 0)
  );
}

export function createAiBuilderMention(type: 'create', target: AiBuildTarget): AiBuilderMention;
export function createAiBuilderMention(type: 'agent', item: Agent): AiBuilderMention;
export function createAiBuilderMention(type: 'skill', item: Skill): AiBuilderMention;
export function createAiBuilderMention(type: 'workflow', item: Workflow): AiBuilderMention;
export function createAiBuilderMention(
  type: AiBuilderMention['type'],
  item?: Agent | Skill | Workflow | AiBuildTarget
): AiBuilderMention {
  if (type === 'create') {
    const target = item as AiBuildTarget;
    return {
      type: 'create',
      target,
      label: `创建 ${targetLabel(target)}`,
      description: '新建一个资源'
    };
  }
  const resource = item as Agent | Skill | Workflow;
  return {
    type,
    id: resource?.id,
    label: resource?.name || resource?.id || targetLabel(type as AiBuildTarget),
    description: resource?.description
  };
}
