import {
  requireToolContext,
  type ToolExecutionContext
} from '../../../services/ToolExecutionContext.js';
import { BaseTool } from '../../base/BaseTool.js';

export class PublishToGitHubTool extends BaseTool {
  readonly id = 'publish_to_github';
  readonly name = 'publish_to_github';
  readonly displayName = '发布到 GitHub';
  readonly scope = 'workflow' as const;
  readonly description =
    '将日报 Markdown 内容发布到配置的 GitHub 仓库。GitHub 发布流水线最后一步调用。' +
    '必填：date（YYYY-MM-DD）、dailyMd（Markdown 正文）；可选 title。';
  readonly parameters = {
    type: 'object',
    properties: {
      date: { type: 'string', description: '日期 (YYYY-MM-DD)' },
      dailyMd: { type: 'string', description: '日报 Markdown 内容' },
      title: { type: 'string', description: '文章标题 (可选)' }
    },
    required: ['date', 'dailyMd']
  };

  async handler(
    args: { date: string; dailyMd: string; title?: string },
    _toolCtx?: ToolExecutionContext
  ) {
    const context = requireToolContext(_toolCtx, this.id).services;
    const githubPublisher = context.publisherInstances.find((p) => p.id === 'github') as any;
    const prefix = githubPublisher?.config?.pathPrefix || 'daily';
    const displayDate = args.date.replace(/-/g, '/').replace(/\b0(\d)\b/g, '$1');

    return await context.taskService.publish('github', args.dailyMd, {
      filePath: `${prefix}/${args.date}.md`,
      message: args.title || `AI资讯日报 ${displayDate}`,
      title: args.title,
      date: args.date
    });
  }
}
