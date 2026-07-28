const MARKDOWN_LINK_SEGMENT = /(\[[^\]]*\]\([^)]+\))/g;
const BARE_URL_PATTERN = /((https?:\/\/)[^\s<>()[\]]+)/gi;
const GFM_ANGLE_AUTOLINK = /<(https?:\/\/[^>\s]+)>/gi;

const PLAIN_LEXICAL_NODE_TYPES = new Set([
  'action-tag',
  'autolink',
  'linebreak',
  'link',
  'mention',
  'paragraph',
  'refer-topic',
  'root',
  'text',
]);

const LEXICAL_ONLY_NODE_TYPES = new Set([
  'attachment',
  'file',
  'image',
  'image-block',
  'inline-image',
  'upload-image',
]);

function stripTrailingPunctuation(url: string): { url: string; suffix: string } {
  let clean = url;
  let suffix = '';
  while (clean.length > 0 && /[).,;!?]$/.test(clean)) {
    suffix = clean.slice(-1) + suffix;
    clean = clean.slice(0, -1);
  }
  return { url: clean, suffix };
}

function wrapBareUrls(segment: string): string {
  return segment.replace(BARE_URL_PATTERN, (match) => {
    const { url, suffix } = stripTrailingPunctuation(match);
    if (!url) return match;
    return `[${url}](${url})${suffix}`;
  });
}

const MERMAID_FENCE_PATTERN = /```mermaid\n([\s\S]*?)```/gi;

/**
 * Lobehub's Mermaid renderer uses `securityLevel: 'strict'`, which rejects HTML
 * such as `<br/>` inside node labels. Models often emit those tags for multiline
 * labels, which makes `mermaid.parse()` fail and leaves a broken image placeholder.
 */
export function sanitizeMermaidFences(text: string): string {
  return text.replace(MERMAID_FENCE_PATTERN, (_fence, body: string) => {
    const normalized = body
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/ +\n/g, '\n')
      .replace(/\n +/g, '\n');
    return `\`\`\`mermaid\n${normalized}\`\`\``;
  });
}

/** Normalize bare / GFM-angle URLs into markdown links before rendering. */
export function ensureMarkdownLinks(text: string): string {
  if (!text) return text;

  const withoutAngleAutolinks = text.replace(GFM_ANGLE_AUTOLINK, '$1');

  return withoutAngleAutolinks
    .split(MARKDOWN_LINK_SEGMENT)
    .map((segment) => {
      if (segment.startsWith('[') && segment.includes('](')) {
        return segment;
      }
      return wrapBareUrls(segment);
    })
    .join('');
}

function walkEditorNode(node: unknown): boolean {
  if (!node || typeof node !== 'object') return false;

  const record = node as Record<string, unknown>;
  const type = typeof record.type === 'string' ? record.type : '';

  if (LEXICAL_ONLY_NODE_TYPES.has(type)) return true;
  if (type && !PLAIN_LEXICAL_NODE_TYPES.has(type)) return true;

  const children = record.children;
  if (!Array.isArray(children)) return false;

  return children.some((child) => walkEditorNode(child));
}

/** True when Lexical JSON must keep RichTextMessage (inline uploads, unknown nodes). */
export function editorDataNeedsRichTextRenderer(editorData: unknown): boolean {
  if (!editorData || typeof editorData !== 'object') return false;
  if (Object.keys(editorData as Record<string, unknown>).length === 0) return false;
  return walkEditorNode((editorData as Record<string, unknown>).root);
}

export function extractPlainTextFromEditorData(editorData: unknown): string {
  const parts: string[] = [];

  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    const record = node as Record<string, unknown>;
    if (record.type === 'text' && typeof record.text === 'string') {
      parts.push(record.text);
    }
    if (Array.isArray(record.children)) {
      for (const child of record.children) {
        walk(child);
      }
    }
  };

  walk((editorData as Record<string, unknown>).root);
  return parts.join('').trim();
}
