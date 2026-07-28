import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

const ALLOWED_TAGS = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'br',
  'hr',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'code',
  'em',
  'strong',
  'b',
  'i',
  'u',
  's',
  'del',
  'a',
  'img',
  'figure',
  'figcaption',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'div',
  'span',
  'section',
  'article',
  'sup',
  'sub'
];

const SANITIZE: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    a: ['href', 'name', 'target', 'rel', 'title'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    code: ['class'],
    pre: ['class'],
    th: ['colspan', 'rowspan'],
    td: ['colspan', 'rowspan'],
    '*': ['id']
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', {
      rel: 'noopener noreferrer',
      target: '_blank'
    })
  }
};

marked.setOptions({
  gfm: true,
  breaks: false
});

/** True when the blob looks like HTML rather than Markdown/plain text. */
export function looksLikeHtml(raw: string): boolean {
  const sample = raw.trim().slice(0, 800);
  if (!sample) return false;
  if (/<(script|style|html|body|article|section|div|p|h[1-6]|ul|ol|li|br|img|table)\b/i.test(sample)) {
    return true;
  }
  // Generic tag pair / void tag density
  const tags = sample.match(/<\/?[a-z][a-z0-9]*\b[^>]*>/gi);
  return Boolean(tags && tags.length >= 2);
}

export function sanitizeArticleHtml(html: string): string {
  return sanitizeHtml(html, SANITIZE).trim();
}

export async function markdownToSafeHtml(markdown: string): Promise<string> {
  const html = await marked.parse(markdown);
  return sanitizeArticleHtml(typeof html === 'string' ? html : String(html));
}

/**
 * Turn pipeline `content_html` / `full_content` into safe HTML for rendering.
 * Detects HTML vs Markdown; always sanitizes before return.
 */
export async function renderArticleBodyHtml(
  raw: string,
  opts?: { stripTitle?: string }
): Promise<string> {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  let html = looksLikeHtml(trimmed)
    ? sanitizeArticleHtml(trimmed)
    : await markdownToSafeHtml(trimmed);

  if (opts?.stripTitle) {
    html = stripLeadingTitleHeading(html, opts.stripTitle);
  }

  return html;
}

function stripLeadingTitleHeading(html: string, title: string): string {
  const norm = title.trim();
  if (!norm) return html;
  // Remove first h1/h2 whose text matches the article title (common in scraped HTML).
  return html.replace(/<h([12])(\s[^>]*)?>([\s\S]*?)<\/h\1>/i, (full, _level, _attrs, inner) => {
    const text = sanitizeHtml(inner, { allowedTags: [], allowedAttributes: {} })
      .replace(/\s+/g, ' ')
      .trim();
    if (text === norm || (norm.length > 8 && text.startsWith(norm) && text.length < norm.length + 12)) {
      return '';
    }
    return full;
  });
}
