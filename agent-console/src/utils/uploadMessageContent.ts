/** Uploaded attachments must not appear in message markdown — only in imageList/fileList. */

export const UPLOAD_MARKDOWN_IMAGE_RE =
  /!\[[^\]]*\]\((?:blob:[^)]*|[^)]*\/api\/agent-uploads\/[^)]*)\)/gi;

const ATTACHED_FILES_INDEX_RE =
  /\n\n\[Attached files available via read_upload\]\n(?:- [^\n]+\n?)*/;

const EMBED_MEDIA_NODE_TYPES = new Set([
  'image',
  'inline-image',
  'image-block',
  'upload-image',
  'file',
  'attachment',
]);

export function stripUploadMediaFromMarkdown(markdown: string): string {
  return markdown.replace(UPLOAD_MARKDOWN_IMAGE_RE, '').replace(/\n{3,}/g, '\n\n').trim();
}

/** Runtime file index for read_upload — must not appear in user bubbles. */
export function stripAttachedFilesIndexFromMarkdown(markdown: string): string {
  return markdown.replace(ATTACHED_FILES_INDEX_RE, '').trim();
}

export function stripEmbedMediaFromEditorData(
  editorData: unknown,
): Record<string, unknown> | undefined {
  if (!editorData || typeof editorData !== 'object') return undefined;

  const stripNode = (node: unknown): unknown => {
    if (!node || typeof node !== 'object') return node;
    const record = node as Record<string, unknown>;
    const type = typeof record.type === 'string' ? record.type : '';
    if (EMBED_MEDIA_NODE_TYPES.has(type)) return null;

    if (!Array.isArray(record.children)) return record;

    const children = record.children
      .map(stripNode)
      .filter((child): child is unknown => child != null);

    return { ...record, children };
  };

  const record = editorData as Record<string, unknown>;
  if (!record.root) return record;
  return { ...record, root: stripNode(record.root) };
}
