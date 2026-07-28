export interface DocumentFrontmatter {
  title?: string;
  status?: string;
  tags?: string;
  raw: Record<string, string>;
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

function parseYamlBlock(block: string): Record<string, string> {
  const raw: Record<string, string> = {};
  for (const line of block.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const colon = trimmed.indexOf(':');
    if (colon === -1) continue;
    const key = trimmed.slice(0, colon).trim();
    const value = trimmed.slice(colon + 1).trim();
    if (key) raw[key] = value;
  }
  return raw;
}

export function parseMarkdownFrontmatter(markdown: string): {
  frontmatter: DocumentFrontmatter;
  body: string;
} {
  const match = markdown.match(FRONTMATTER_RE);
  if (!match) {
    return { frontmatter: { raw: {} }, body: markdown };
  }

  const raw = parseYamlBlock(match[1]);
  return {
    frontmatter: {
      title: raw.title,
      status: raw.status,
      tags: raw.tags,
      raw,
    },
    body: markdown.slice(match[0].length),
  };
}

export function serializeMarkdownFrontmatter(
  frontmatter: DocumentFrontmatter,
  body: string,
): string {
  const entries = Object.entries(frontmatter.raw).filter(([, value]) => value.length > 0);
  if (!entries.length) return body;

  const yaml = entries.map(([key, value]) => `${key}: ${value}`).join('\n');
  const normalizedBody = body.startsWith('\n') ? body : `\n${body}`;
  return `---\n${yaml}\n---${normalizedBody}`;
}

export function buildDocumentFrontmatterRows(
  frontmatter: DocumentFrontmatter,
  fallbackTitle: string,
): Array<{ key: string; value: string }> {
  return [
    { key: 'title', value: frontmatter.title?.trim() || fallbackTitle },
    { key: 'status', value: frontmatter.status?.trim() || 'draft' },
    { key: 'tags', value: frontmatter.tags?.trim() || '—' },
  ];
}

export function buildNewMarkdownDocumentContent(fileName: string): string {
  const title = fileName.replace(/\.md$/i, '');
  return serializeMarkdownFrontmatter(
    { raw: { title, status: 'draft' } },
    `# ${title}\n\n`,
  );
}

const FRONTMATTER_STATUS_OPTIONS = ['draft', 'review', 'published', 'archived'] as const;

export type DocumentFrontmatterStatus = (typeof FRONTMATTER_STATUS_OPTIONS)[number];

export function documentFrontmatterForEdit(
  frontmatter: DocumentFrontmatter,
  fallbackTitle: string,
): DocumentFrontmatter {
  const title = frontmatter.title?.trim() || fallbackTitle;
  const status = frontmatter.status?.trim() || 'draft';
  const tags = frontmatter.tags?.trim() ?? '';
  return {
    title,
    status,
    tags,
    raw: { ...frontmatter.raw, title, status, ...(tags ? { tags } : {}) },
  };
}

export function patchDocumentFrontmatter(
  frontmatter: DocumentFrontmatter,
  patch: Partial<Pick<DocumentFrontmatter, 'title' | 'status' | 'tags'>>,
): DocumentFrontmatter {
  const raw = { ...frontmatter.raw };
  if (patch.title !== undefined) {
    const value = patch.title.trim();
    if (value) raw.title = value;
    else delete raw.title;
  }
  if (patch.status !== undefined) {
    const value = patch.status.trim();
    if (value) raw.status = value;
    else delete raw.status;
  }
  if (patch.tags !== undefined) {
    const value = patch.tags.trim();
    if (value) raw.tags = value;
    else delete raw.tags;
  }
  return {
    title: raw.title,
    status: raw.status,
    tags: raw.tags,
    raw,
  };
}

export { FRONTMATTER_STATUS_OPTIONS };
