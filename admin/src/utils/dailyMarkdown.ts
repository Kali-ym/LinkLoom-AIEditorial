/** 预览用：拆分 Hugo front matter 与正文（不修改存储内容） */
export function splitDailyMarkdown(content: string): {
  frontMatter: Record<string, string>;
  body: string;
  displayTitle: string;
} {
  const raw = (content || '').replace(/^\uFEFF/, '').replace(/\\n/g, '\n').trim();
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (match) {
    const frontMatter = parseFrontMatterBlock(match[1]);
    return {
      frontMatter,
      body: match[2].trim(),
      displayTitle: frontMatter.title || ''
    };
  }

  // 模型把 YAML 挤在一行或未正确闭合时：用正则抽 title，正文从顶栏引用或「今日摘要」起
  if (raw.startsWith('---')) {
    const titleMatch = raw.match(/title:\s*(AI资讯日报\s*[\d/]+)/);
    const bodyStart = raw.search(/(?:^|\n)(>\s|##\s*\*{0,2}今日摘要)/m);
    if (bodyStart >= 0) {
      return {
        frontMatter: titleMatch ? { title: titleMatch[1].trim() } : {},
        body: raw.slice(bodyStart).trim(),
        displayTitle: titleMatch?.[1]?.trim() || ''
      };
    }
  }

  return { frontMatter: {}, body: raw, displayTitle: '' };
}

function parseFrontMatterBlock(block: string): Record<string, string> {
  const frontMatter: Record<string, string> = {};
  const normalized = block.includes('\n')
    ? block
    : block.replace(/(linkTitle:|title:|weight:|breadcrumbs:|comments:|description:)/g, '\n$1');
  for (const line of normalized.split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!kv) continue;
    let val = kv[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    frontMatter[kv[1]] = val;
  }
  return frontMatter;
}

export function hasDailyFrontMatter(content: string): boolean {
  const raw = (content || '').trim();
  return (
    /^\s*---\r?\n[\s\S]*?\r?\n---/.test(raw) ||
    /^\s*---/.test(raw) ||
    /title:\s*AI资讯日报/.test(raw)
  );
}
