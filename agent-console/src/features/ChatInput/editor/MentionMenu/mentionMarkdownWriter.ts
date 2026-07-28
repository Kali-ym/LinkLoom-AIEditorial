export function escapeXmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Upstream `InputEditor` mentionMarkdownWriter */
export function mentionMarkdownWriter(mention: {
  label?: string;
  metadata?: Record<string, unknown>;
}): string {
  if (mention.metadata?.type === 'topic') {
    return `<refer_topic name="${escapeXmlAttr(String(mention.metadata.topicTitle ?? mention.label ?? ''))}" id="${escapeXmlAttr(String(mention.metadata.topicId ?? ''))}" />`;
  }
  if (mention.metadata?.type === 'localFile') {
    const name = escapeXmlAttr(String(mention.metadata.name ?? mention.label ?? ''));
    const path = escapeXmlAttr(String(mention.metadata.path ?? ''));
    const isDirectory = mention.metadata.isDirectory ? ' isDirectory' : '';
    return `<localFile name="${name}" path="${path}"${isDirectory} />`;
  }
  return `<mention name="${escapeXmlAttr(String(mention.label ?? ''))}" id="${escapeXmlAttr(String(mention.metadata?.id ?? ''))}" />`;
}
