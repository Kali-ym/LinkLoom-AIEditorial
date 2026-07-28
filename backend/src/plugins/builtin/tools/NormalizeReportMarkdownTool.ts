import {
  fixBodyMarkdownStructure,
  normalizeSourceUrlLines,
  stripLeadingFrontMatter,
  stripMediaFromBody,
  unfoldEscapedNewlines
} from '../../../utils/normalizeDailyMarkdown.js';
import { BaseTool } from '../../base/BaseTool.js';

function formatDatePart(date: string, token: string): string {
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return date;
  const [, yyyy, mm, dd] = m;
  const month = String(Number(mm));
  const day = String(Number(dd));
  return token
    .replace(/\{yyyy\}/g, yyyy)
    .replace(/\{mm\}/g, mm)
    .replace(/\{dd\}/g, dd)
    .replace(/\{m\}/g, month)
    .replace(/\{d\}/g, day)
    .replace(/\{date\}/g, date);
}

function buildFrontMatter(fields: Record<string, unknown>) {
  const lines = ['---'];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null || value === '') continue;
    const str = String(value);
    if (/[:#[\]{},"\n]/.test(str)) {
      lines.push(`${key}: "${str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`);
    } else {
      lines.push(`${key}: ${str}`);
    }
  }
  lines.push('---');
  return lines.join('\n');
}

export class NormalizeReportMarkdownTool extends BaseTool {
  readonly id = 'normalize_report_markdown';
  readonly name = 'normalize_report_markdown';
  readonly displayName = 'Markdown 规范化';
  readonly scope = 'workflow' as const;
  readonly description =
    '规范化日报 Markdown：补全 front matter、应用标题模板、可选剥离媒体。发布前格式化步骤调用。' +
    '必填：markdown 或 input；可选 date（YYYY-MM-DD）、titleTemplate、stripMedia。';
  readonly parameters = {
    type: 'object',
    properties: {
      markdown: { type: 'string', description: 'Markdown to normalize' },
      input: { type: 'string', description: 'Alias for markdown' },
      date: { type: 'string', description: 'Report date YYYY-MM-DD' },
      titleTemplate: { type: 'string', description: 'Example: AI资讯日报 {yyyy}/{m}/{d}' },
      linkTitleTemplate: { type: 'string', description: 'Example: {mm}-{dd} AI资讯' },
      descriptionDefault: { type: 'string' },
      stripMedia: { type: 'boolean' },
      frontMatterRules: { type: 'object', description: 'Additional/overriding front matter fields' }
    }
  };

  async handler(args: {
    markdown?: string;
    input?: string;
    date?: string;
    titleTemplate?: string;
    linkTitleTemplate?: string;
    descriptionDefault?: string;
    stripMedia?: boolean;
    frontMatterRules?: Record<string, unknown>;
  }) {
    const raw = unfoldEscapedNewlines(String(args.markdown ?? args.input ?? '').trim());
    if (!raw) return { success: true, content: '' };

    const date = args.date || new Date().toISOString().slice(0, 10);
    const issueMatch = raw.match(/^(<!--\s*issues:[\s\S]*?-->\s*)/);
    const issuePrefix = issueMatch?.[1] || '';
    const withoutIssue = issuePrefix ? raw.slice(issuePrefix.length).trimStart() : raw;
    let body = stripLeadingFrontMatter(withoutIssue).trim();
    if (args.stripMedia !== false) body = stripMediaFromBody(body);
    body = normalizeSourceUrlLines(fixBodyMarkdownStructure(body));

    const fields: Record<string, unknown> = {
      linkTitle: formatDatePart(date, args.linkTitleTemplate || '{mm}-{dd} Report'),
      title: formatDatePart(date, args.titleTemplate || 'Report {yyyy}/{m}/{d}'),
      breadcrumbs: false,
      comments: true,
      description: args.descriptionDefault || 'Selected report highlights.',
      ...(args.frontMatterRules || {})
    };
    const content = `${issuePrefix}${buildFrontMatter(fields)}\n\n${body}\n`;
    return { success: true, content, markdown: content };
  }
}
