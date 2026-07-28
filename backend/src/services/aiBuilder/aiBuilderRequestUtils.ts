import type {
  AiBuildChatMessage,
  AiBuildRequest,
  AiBuilderMention,
  AiBuildTarget
} from '../../types/aiBuilder.js';

export function mentionTarget(mention: AiBuilderMention): AiBuildTarget | undefined {
  if (mention.type === 'create') return mention.target;
  if (mention.type === 'agent' || mention.type === 'skill' || mention.type === 'workflow')
    return mention.type;
  return undefined;
}

export function lastUserText(messages: AiBuildChatMessage[]) {
  return (
    [...messages]
      .reverse()
      .find((message) => message.role === 'user')
      ?.content?.trim() || ''
  );
}

function readStructuredPlanAnswer(value: unknown): {
  selectedOptionIds: string[];
  customText: string;
} {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const objectValue = value as { selectedOptionIds?: unknown[]; customText?: unknown };
    return {
      selectedOptionIds: Array.isArray(objectValue.selectedOptionIds)
        ? objectValue.selectedOptionIds.map(String)
        : [],
      customText: typeof objectValue.customText === 'string' ? objectValue.customText : ''
    };
  }
  if (Array.isArray(value)) return { selectedOptionIds: value.map(String), customText: '' };
  if (typeof value === 'string' && value.trim())
    return { selectedOptionIds: [value.trim()], customText: '' };
  return { selectedOptionIds: [], customText: '' };
}

export function mentionsRequestNewCapabilities(mentions: AiBuilderMention[]) {
  return mentions.some(
    (mention) =>
      mention.type === 'create' && (mention.target === 'agent' || mention.target === 'skill')
  );
}

export function textForbidsNewCapabilities(text: string) {
  return /不要(?:新建|创建|新增)|不(?:要|允许)(?:新建|创建|新增)|只能(?:用|使用|复用)现有|只(?:用|使用|复用)现有|existing\s*only|no\s*new/i.test(
    text
  );
}

export function textAllowsNewCapabilities(text: string) {
  return /(?:允许|可以|需要|帮我)(?:新建|创建|新增).*(?:智能体|agent|技能|skill|能力)|(?:缺少|没有|不够).*(?:能力|智能体|agent|技能|skill).*(?:就|则|可以)?.*(?:新建|创建|新增)|(?:新建|创建|新增).*(?:智能体|agent|技能|skill)/i.test(
    text
  );
}

export function yesLike(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === 'string')
    return /^(yes|true|allow|allowed|是|允许|可以|新建)$/i.test(value.trim());
  if (Array.isArray(value)) return value.some(yesLike);
  if (value && typeof value === 'object') {
    const objectValue = value as { selectedOptionIds?: unknown[]; customText?: unknown };
    return yesLike(objectValue.selectedOptionIds) || yesLike(objectValue.customText);
  }
  return false;
}

export function reusePolicyFromPlanAnswers(
  planAnswers?: Record<string, unknown>
): AiBuildRequest['reusePolicy'] | undefined {
  for (const key of ['reuse_policy', 'workflow_create_resources']) {
    const value = planAnswers?.[key];
    if (value === undefined || value === null) continue;
    const structured = readStructuredPlanAnswer(value);
    if (structured.selectedOptionIds.includes('allowCreate')) return 'allowCreate';
    if (structured.selectedOptionIds.includes('existingOnly')) return 'existingOnly';
    if (structured.selectedOptionIds.includes('preferExisting')) return 'preferExisting';
    if (yesLike(value)) return 'allowCreate';
    if (structured.customText.trim()) {
      if (textForbidsNewCapabilities(structured.customText)) return 'existingOnly';
      if (textAllowsNewCapabilities(structured.customText)) return 'allowCreate';
    }
  }
  return undefined;
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
