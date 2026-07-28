import type { ServiceContext } from '../ServiceContext.js';

/**
 * /api/tools 路由的协调服务。
 *
 * 让 `toolRoutes.ts` 与其他 *RouteService 风格一致：路由只解参数，业务委托本类。
 * 实际能力仍由 `ExecutionService` 提供，本类是一个薄包装，便于后续把通用错误响应、
 * 权限校验、审计日志等横切关注点集中处理。
 */
export class ToolRouteService {
  constructor(private context: ServiceContext) {}

  listAvailableTools() {
    return this.context.executionService.listAvailableTools();
  }

  async runTool(
    id: string,
    args: unknown
  ): Promise<{ statusCode?: number } & Record<string, unknown>> {
    const result = await this.context.executionService.runTool(id, args);
    return result;
  }
}
