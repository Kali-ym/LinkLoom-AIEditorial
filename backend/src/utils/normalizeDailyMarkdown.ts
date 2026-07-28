/**
 * 规范化 AI 日报 Markdown：单一 front matter、固定标题格式、剥离图片/视频。
 */

const FM_BLOCK = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/** 将字面量 \\n 还原为换行（模型 JSON 转义残留） */
export function unfoldEscapedNewlines(text: string): string {
  return text.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t');
}

/** 剥离文首所有 YAML front matter（LLM 可能重复输出多段） */
export function stripLeadingFrontMatter(markdown: string): string {
  let content = unfoldEscapedNewlines(markdown)
    .replace(/^\uFEFF?/, '')
    .trimStart();
  while (FM_BLOCK.test(content)) {
    content = content.replace(FM_BLOCK, '').trimStart();
  }
  if (content.startsWith('---')) {
    const end = content.search(/\r?\n---\r?\n?/);
    if (end > 0) {
      content = content.slice(end + content.match(/\r?\n---\r?\n?/)![0].length).trimStart();
    }
  }
  return content;
}

/** 移除正文中的图片、视频与 RSS 占位（当前版本不嵌入媒体） */
export function stripMediaFromBody(body: string): string {
  return body
    .replace(/<video[\s\S]*?<\/video>/gi, '')
    .replace(/<img[^>]*>/gi, '')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[图片:[^\]]*\]/gi, '')
    .replace(/\[视频:[^\]]*\]/gi, '')
    .replace(/\[▶[^\]]*\]\([^)]+\)/g, '')
    .replace(/(<br\s*\/?>\s*){2,}/gi, '<br/>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parseDateParts(
  date: string
): { year: string; month: number; day: number; mm: string; dd: string } | null {
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return {
    year: m[1],
    month: Number(m[2]),
    day: Number(m[3]),
    mm: m[2],
    dd: m[3]
  };
}

/** 从正文或 workflow date 推断 YYYY-MM-DD（不信任畸形 title 中的重复年份） */
export function inferDailyDate(markdown: string, workflowDate?: string): string | null {
  if (workflowDate && /^\d{4}-\d{2}-\d{2}$/.test(workflowDate)) {
    return workflowDate;
  }
  const titleLine = markdown.match(/title:\s*AI资讯日报\s+(\d{4})\/(\d{1,2})\/(\d{1,2})/i);
  if (titleLine) {
    const [, y, m, d] = titleLine;
    const month = Number(m);
    const day = Number(d);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
  }
  const linkBad = markdown.match(/linkTitle:\s*(\d{4})-(\d{2})\s+AI资讯/);
  if (linkBad && !markdown.match(/linkTitle:\s*\d{2}-\d{2}\s+AI资讯/)) {
    const dayFromSlug = markdown.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
    if (dayFromSlug?.[1]) return dayFromSlug[1];
  }
  const inQuotes = markdown.match(/每日早读[^|]*\|\s*`?(\d{4}-\d{2}-\d{2})`?/);
  if (inQuotes?.[1]) return inQuotes[1];
  const slug = markdown.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  return slug?.[1] || null;
}

/** 修复 LLM 把 ### 或列表序号塞进 <br/> 的行内 HTML */
export function fixBodyMarkdownStructure(body: string): string {
  let b = body.replace(/\r\n/g, '\n');
  b = b.replace(/<br\s*\/?>\s*(?=###\s)/gi, '\n\n');
  b = b.replace(/<br\s*\/?>\s*(?=\d+\.\s+\*\*)/gi, '\n\n');
  b = b.replace(/<br\s*\/?>/gi, '\n');

  const sections = b.split(/(?=^###\s)/m);
  const fixedSections = sections.map((section) => {
    if (!/^###\s/m.test(section)) return section;
    const nl = section.indexOf('\n');
    const header = nl >= 0 ? section.slice(0, nl) : section;
    let rest = nl >= 0 ? section.slice(nl + 1) : '';
    let n = 0;
    rest = rest.replace(/^(\d+)\.\s+(\*\*)/gm, (_match, _num, stars) => {
      n += 1;
      return `${n}. ${stars}`;
    });
    return `${header}\n${rest}`;
  });
  return fixedSections
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** 页面标题：AI资讯日报 YYYY/M/D（月、日去前导零） */
export function formatDailyPageTitle(date: string): string {
  const parts = parseDateParts(date);
  if (!parts) {
    throw new Error(`Invalid date for daily title: ${date}`);
  }
  return `AI资讯日报 ${parts.year}/${parts.month}/${parts.day}`;
}

/** 侧栏短标题：MM-dd AI资讯 */
export function formatDailyLinkTitle(date: string): string {
  const parts = parseDateParts(date);
  if (!parts) {
    throw new Error(`Invalid date for daily linkTitle: ${date}`);
  }
  return `${parts.mm}-${parts.dd} AI资讯`;
}

export function buildDailyFrontMatter(date: string, description?: string): string {
  const parts = parseDateParts(date);
  if (!parts) {
    throw new Error(`Invalid date for daily front matter: ${date}`);
  }
  const desc =
    (description || '').trim().replace(/\s+/g, ' ').slice(0, 80) ||
    'AI 资讯日报 — 当日精选要点摘要。';
  const escaped = desc.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return [
    '---',
    `linkTitle: ${formatDailyLinkTitle(date)}`,
    `title: ${formatDailyPageTitle(date)}`,
    `weight: ${32 - parts.day}`,
    'breadcrumbs: false',
    'comments: true',
    `description: "${escaped}"`,
    '---'
  ].join('\n');
}

function splitInlineSourceContinuations(body: string): string {
  const nextMarkdownBlock = '(?=(?:\\d+\\.\\s+|#{2,6}\\s+))';
  return body
    .replace(
      new RegExp(
        `^([ \\t]*来源[：:]\\s*\\[[^\\]\\n]+\\]\\([^)]+\\))\\s+${nextMarkdownBlock}`,
        'gm'
      ),
      '$1\n\n'
    )
    .replace(
      new RegExp(`^([ \\t]*来源[：:]\\s*https?:\\/\\/\\S+?)\\s+${nextMarkdownBlock}`, 'gm'),
      '$1\n\n'
    );
}

/** 将「来源：裸 URL」改为 Markdown 链接，便于站点渲染可点击 */
export function normalizeSourceUrlLines(body: string): string {
  return splitInlineSourceContinuations(body).replace(
    /^([ \t]*)来源[：:][ \t]*(https?:\/\/\S+)[ \t]*$/gm,
    (_match, indent: string, url: string) => `${indent}来源：[${url}](${url})`
  );
}

function resolveCanonicalDailyDate(markdown: string, workflowDate?: string): string | null {
  if (workflowDate && /^\d{4}-\d{2}-\d{2}$/.test(workflowDate)) {
    return workflowDate;
  }
  return inferDailyDate(markdown, undefined);
}

export interface NormalizeDailyOptions {
  /** 工作流/发布传入的归档日 YYYY-MM-DD */
  date?: string;
  /** 若正文含今日要闻，用于 description */
  descriptionFromSummary?: boolean;
}

function extractHeadlinesDescription(body: string): string {
  const section = body.match(/##\s*\*\*今日要闻\*\*\s*\n+([\s\S]*?)(?=\n##\s|\n###\s|$)/i);
  if (!section?.[1]) return '';
  return section[1]
    .replace(/^\d+\.\s+\*\*[^*]+\*\*\s*/gm, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

/**
 * 产出可直接保存/发布的日报 Markdown：唯一 front matter + 规范标题 + 无图片视频。
 */
export function normalizeDailyMarkdown(
  markdown: string,
  options: NormalizeDailyOptions = {}
): string {
  let raw = unfoldEscapedNewlines((markdown || '').trim());
  if (!raw) return raw;

  // 去掉 HTML 质检注释后仍保留（放最前）
  const issueMatch = raw.match(/^(<!--\s*issues:[\s\S]*?-->\s*)/);
  const issuePrefix = issueMatch?.[1] || '';
  if (issuePrefix) {
    raw = raw.slice(issuePrefix.length).trimStart();
  }

  const body = normalizeSourceUrlLines(
    fixBodyMarkdownStructure(stripMediaFromBody(stripLeadingFrontMatter(raw).trim()))
  );
  const date =
    resolveCanonicalDailyDate(raw, options.date) || resolveCanonicalDailyDate(body, options.date);
  if (!date) {
    return issuePrefix + raw;
  }

  const desc = options.descriptionFromSummary !== false ? extractHeadlinesDescription(body) : '';
  const fm = buildDailyFrontMatter(date, desc);
  const normalized = `${fm}\n\n${body}\n`;
  return issuePrefix ? `${issuePrefix}${normalized}` : normalized;
}
