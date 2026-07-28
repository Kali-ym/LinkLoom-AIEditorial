import type { UserLinkCard, UserLinkLine } from '../domain/types/conversation';

export interface ParsedUserMessageContent {
  plainText: string;
  text?: string;
  linkLine?: UserLinkLine;
  linkCard?: UserLinkCard;
}

/** User text is rendered via Markdown; bare URLs are linkified in UserMessageContent. */
export function parseUserMessageContent(raw: string): ParsedUserMessageContent {
  const plainText = raw.trim();
  return { plainText, text: plainText };
}

const MS_MINUTE = 60_000;
const MS_HOUR = 3_600_000;
const MS_DAY = 86_400_000;

function parseMessageTime(createdAt: string): Date | null {
  if (/^\d{1,2}:\d{2}$/.test(createdAt)) {
    const [hour, minute] = createdAt.split(':').map(Number);
    const date = new Date();
    date.setHours(hour, minute, 0, 0);
    return date;
  }
  const date = new Date(createdAt);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatUserMessageTime(createdAt: string): string {
  return formatMessageTime(createdAt);
}

/** 刚刚 → 分钟前 → 小时前 → 天前（3 天内）→ 月日 → 年月日（跨年） */
export function formatMessageTime(createdAt: string, nowMs = Date.now()): string {
  const date = parseMessageTime(createdAt);
  if (!date) return createdAt;

  const diffMs = nowMs - date.getTime();
  if (diffMs < MS_MINUTE) return '刚刚';

  const diffMins = Math.floor(diffMs / MS_MINUTE);
  if (diffMins < 60) return `${diffMins} 分钟前`;

  const diffHours = Math.floor(diffMs / MS_HOUR);
  if (diffHours < 24) return `${diffHours} 小时前`;

  const diffDays = Math.floor(diffMs / MS_DAY);
  if (diffDays <= 3) return `${diffDays} 天前`;

  const now = new Date(nowMs);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  if (year !== now.getFullYear()) {
    return `${year}年${month}月${day}日`;
  }
  return `${month}月${day}日`;
}

function resolveAttachedLink(message: {
  linkLine?: UserLinkLine;
  linkCard?: UserLinkCard;
}): string | undefined {
  if (message.linkLine?.url) {
    const { url, label } = message.linkLine;
    return label ? `[${label}](${url})` : url;
  }
  if (message.linkCard?.url) {
    return message.linkCard.url;
  }
  return undefined;
}

export function buildPlainText(message: {
  text?: string;
  linkLine?: UserLinkLine;
  linkCard?: UserLinkCard;
  content?: string;
}): string {
  const body = (message.text ?? message.content ?? '').trim();
  const link = resolveAttachedLink(message);
  if (!link) return body;
  const rawUrl = message.linkLine?.url ?? message.linkCard?.url ?? '';
  if (!body || (rawUrl && body.includes(rawUrl))) return body || link;
  return `${link} ${body}`;
}

export function resolveUserMessageText(message: {
  text?: string;
  linkLine?: UserLinkLine;
  linkCard?: UserLinkCard;
  content?: string;
}): string {
  if (message.linkLine || message.linkCard) {
    return buildPlainText(message);
  }
  return (message.text ?? message.content ?? '').trim();
}

export function toUserMessageDisplay(message: {
  content?: string;
  text?: string;
  linkLine?: UserLinkLine;
  linkCard?: UserLinkCard;
}): ParsedUserMessageContent {
  const plainText = resolveUserMessageText(message);
  return {
    plainText,
    text: plainText,
    linkLine: message.linkLine,
    linkCard: message.linkCard,
  };
}
