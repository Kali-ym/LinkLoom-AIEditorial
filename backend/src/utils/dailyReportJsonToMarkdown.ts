/**
 * 将 JSON 版日报转为 Markdown，供提交后写入知识库与跨日覆盖索引解析。
 */
export function dailyReportJsonToMarkdown(report: Record<string, unknown>): string {
  const title = String(report.title ?? 'AI资讯日报');
  const lines: string[] = [`# ${title}`, ''];

  const description = String(report.description ?? '').trim();
  if (description) {
    lines.push(description, '');
  }

  const headlines = Array.isArray(report.headlines) ? report.headlines : [];
  if (headlines.length > 0) {
    lines.push('## 头条', '');
    for (const raw of headlines) {
      const h = raw as Record<string, unknown>;
      const headline = String(h.title ?? '').trim();
      if (!headline) continue;
      const url = String(h.url ?? '').trim();
      lines.push(url ? `- [${headline}](${url})` : `- ${headline}`);
    }
    lines.push('');
  }

  const topQuotes = String(report.topQuotesMd ?? '').trim();
  if (topQuotes) {
    lines.push(topQuotes, '');
  }

  const sections = Array.isArray(report.sections) ? report.sections : [];
  for (const raw of sections) {
    const section = raw as Record<string, unknown>;
    const sectionTitle = String(section.title ?? section.id ?? '').trim();
    if (sectionTitle) {
      lines.push(`## ${sectionTitle}`, '');
    }
    const items = Array.isArray(section.items) ? section.items : [];
    for (const itemRaw of items) {
      const item = itemRaw as Record<string, unknown>;
      const itemTitle = String(item.title ?? '').trim();
      if (itemTitle) lines.push(`### ${itemTitle}`);
      const url = String(item.url ?? '').trim();
      if (url) lines.push(`[原文链接](${url})`);
      const body = String(item.bodyMd ?? '').trim();
      if (body) lines.push(body);
      lines.push('');
    }
  }

  const footer = String(report.footerMd ?? '').trim();
  if (footer) {
    lines.push(footer);
  }

  return lines.join('\n').trim();
}
