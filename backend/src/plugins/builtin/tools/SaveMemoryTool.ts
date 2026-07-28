import {
  requireToolContext,
  type ToolExecutionContext
} from '../../../services/ToolExecutionContext.js';
import { normalizeTags } from '../../../utils/helpers.js';
import { BaseTool } from '../../base/BaseTool.js';

export class SaveMemoryTool extends BaseTool {
  readonly id = 'save_memory';
  readonly name = 'save_memory';
  readonly displayName = '保存记忆';
  readonly scope = 'agent' as const;
  readonly description =
    '将长期稳定的事实、用户偏好、编辑规则或任务结论写入长期记忆库。发现可跨会话复用的信息时调用。' +
    '必填：content（Markdown 记忆协议：# 主题 / - **核心结论** / - **关键细节** / - **背景**）。' +
    '禁止保存：日报原文、新闻正文、网页抓取内容、每日 URL 索引等一次性数据。';
  readonly parameters = {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description:
          '必须遵循 Markdown 记忆协议（# 主题 / - **核心结论** / - **关键细节** / - **背景**）。只保存可长期复用的规则、偏好、结论和经验；严禁写入日报全文、新闻原文、抓取列表或每日 URL 索引。'
      },
      importance: {
        type: 'number',
        description: '重要程度 (1-5)，1 为普通，5 为极其重要',
        default: 1
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description:
          '可选的标签数组，用于分类（例如：["preference", "tech_stack"]）。请确保输出为真正的 JSON 数组，不要将其写成字符串形式。'
      },
      targetCategoryId: {
        type: 'string',
        description: '直写指定记忆分类，跳过自动分类器'
      },
      targetCategoryName: {
        type: 'string',
        description: '与 targetCategoryId 联用：分类不存在时创建'
      }
    },
    required: ['content']
  };

  async handler(
    args: {
      content: string;
      importance?: number;
      tags?: string[];
      targetCategoryId?: string;
      targetCategoryName?: string;
    },
    _toolCtx?: ToolExecutionContext
  ) {
    const context = requireToolContext(_toolCtx, this.id).services;
    const id = await context.memoryService.saveMemory(args.content, {
      importance: args.importance,
      tags: normalizeTags(args.tags),
      targetCategoryId: args.targetCategoryId,
      targetCategoryName: args.targetCategoryName,
      targetCategoryDescription: '长期稳定的偏好、规则、结论与流程经验'
    });

    return {
      success: true,
      id,
      message: '记忆已成功保存。'
    };
  }
}
