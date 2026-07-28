import {
  requireToolContext,
  type ToolExecutionContext
} from '../../../services/ToolExecutionContext.js';
import { parseJsonLenient } from '../../../utils/helpers.js';
import { BaseTool } from '../../base/BaseTool.js';

/**
 * Hugo 时代这里把 daily Markdown 写到 `./site/content/...`；现在 web 前端是 Next.js，
 * 直接从 KV (`daily_report_json:<date>`) 拉取结构化 JSON 渲染。
 * 因此本工具调用 local_site 发布器把 report 写入 KV，前端访问 `/daily/<date>`
 * 即可看到新内容。
 */
export class PublishToLocalSiteTool extends BaseTool {
  readonly id = 'publish_to_local_site';
  readonly name = 'publish_to_local_site';
  readonly displayName = '发布到本地站点';
  readonly scope = 'workflow' as const;
  readonly description =
    '将 DailyReportJson 结构化日报写入本地 KV 存储，供 Next.js 站点按 /daily/<date> 渲染。本地站点发布流水线调用。' +
    '必填：date（YYYY-MM-DD）；以及 report（对象）或 reportJson（字符串）二选一。';
  readonly parameters = {
    type: 'object',
    properties: {
      date: { type: 'string', description: '日期 (YYYY-MM-DD)' },
      report: {
        type: 'object',
        description: '结构化日报对象（DailyReportJson）。优先使用本字段。'
      },
      reportJson: {
        type: 'string',
        description: 'report 的 JSON 字符串形式（当上游只能传字符串时使用）'
      },
      title: { type: 'string', description: '文章标题，仅用于提交历史显示' }
    },
    required: ['date']
  };

  async handler(
    args: {
      date: string;
      report?: unknown;
      reportJson?: string;
      title?: string;
    },
    _toolCtx?: ToolExecutionContext
  ) {
    const context = requireToolContext(_toolCtx, this.id).services;
    const report = args.report ?? (args.reportJson ? safeParse(args.reportJson) : undefined);
    if (!report || typeof report !== 'object') {
      throw new Error('publish_to_local_site 需要 report 或 reportJson 参数（DailyReportJson）');
    }

    const displayDate = (args.date || '').replace(/-/g, '/').replace(/\b0(\d)\b/g, '$1');
    const title = args.title || `AI资讯日报 ${displayDate}`;

    return await context.taskService.publish('local_site', JSON.stringify(report), {
      date: args.date,
      title,
      message: title,
      report
    });
  }
}

function safeParse(text: string): unknown {
  try {
    return parseJsonLenient(text);
  } catch {
    return null;
  }
}
