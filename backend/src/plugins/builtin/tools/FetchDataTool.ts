import {
  requireToolContext,
  type ToolExecutionContext
} from '../../../services/ToolExecutionContext.js';
import { BaseTool } from '../../base/BaseTool.js';

export class FetchDataTool extends BaseTool {
  readonly id = 'fetch_data';
  readonly name = 'fetch_data';
  readonly displayName = '抓取数据';
  readonly scope = 'workflow' as const;
  readonly description =
    '从数据适配器抓取资讯并写入数据库（触发 ingestion）。工作流数据采集步骤中调用。' +
    '可选 adapterName（指定单个适配器，省略则运行全部）；可选 date（YYYY-MM-DD，默认今日）。查询已入库数据请用 query_data。';
  readonly parameters = {
    type: 'object',
    properties: {
      adapterName: { type: 'string', description: '适配器名称 (可选)' },
      date: { type: 'string', description: '目标日期 (YYYY-MM-DD, 可选)' }
    }
  };

  async handler(args: { adapterName?: string; date?: string }, _toolCtx?: ToolExecutionContext) {
    const context = requireToolContext(_toolCtx, this.id).services;
    if (args.adapterName) {
      const result = await context.taskService.runSingleAdapterIngestion(
        args.adapterName,
        args.date
      );
      return result.data;
    } else {
      const result = await context.taskService.runDailyIngestion(args.date);
      return result.data;
    }
  }
}
