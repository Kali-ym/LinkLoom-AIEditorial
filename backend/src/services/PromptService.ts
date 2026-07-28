import { PromptRegistry } from './agents/prompt/registry/PromptRegistry.js';

/**
 * PromptService:旧 API 外壳,内部委托给 PromptRegistry。
 *
 * 保留原因:11 处历史调用点使用 PromptService.getInstance().getPrompt(name, vars)。
 * 本轮 P3 把实现下沉到 registry,PromptService 仅做单例透传,后续调用点逐步迁移到
 * PromptRegistry.getInstance() 后可移除本类。
 */
export class PromptService {
  private static instance: PromptService;
  private registry: PromptRegistry;

  private constructor() {
    this.registry = PromptRegistry.getInstance();
  }

  public static getInstance(): PromptService {
    if (!PromptService.instance) {
      PromptService.instance = new PromptService();
    }
    return PromptService.instance;
  }

  /** 加载磁盘模板。委托给 registry,幂等。 */
  public async loadTemplates(): Promise<void> {
    await this.registry.load();
  }

  /**
   * 渲染模板并返回字符串(向后兼容旧签名)。
   * 内部走 registry.render,自动展开 fragment 引用与变量替换。
   */
  public getPrompt(name: string, variables?: Record<string, string>): string {
    return this.registry.getPrompt(name, variables);
  }

  /** 暴露内部 registry,供迁移期新代码使用 */
  public getRegistry(): PromptRegistry {
    return this.registry;
  }
}
