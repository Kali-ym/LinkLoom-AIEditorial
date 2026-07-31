import { wrapTagRaw } from '../sanitize.js';
import type { PromptBuildContext, PromptContribution, PromptProvider } from '../types.js';

/**
 * BaseAgentProvider:把 base agent 全文作为 system prompt 的外层 framework 注入。
 *
 * 包裹式架构:
 *   <base>base 全文(通用身份+工具纪律+输出+格式+安全+ReAct)</base>
 *   <agent_specific>应用 agent 各字段组装内容</agent_specific>
 *
 * 实现策略:
 * - priority=0,排在所有应用字段 Provider(role/identity/capabilities/...)
 *   之前,确保 base 全文出现在 system message 开头。
 * - base 全文从 ctx.registry 的 `base_agent` 模板加载,渲染时展开
 *   其内嵌的 {{#fragment:xxx}}(若有)。
 * - 应用字段内容由其他 Provider 产出,本 Provider 不负责包裹;
 *   包裹逻辑在 assembleSystemMessages 中统一处理(把 base 之后的所有
 *   system_accumulate 贡献合并包进 <agent_specific>)。
 *
 * 单例 base:所有对话型 agent 共享同一份 base_agent 模板。
 * 若 registry 中找不到 base_agent 模板,返回 null(降级为旧行为,无 base 层)。
 */
export class BaseAgentProvider implements PromptProvider {
  id = 'base_agent';
  phase = 'system_accumulate' as const;
  priority = 0;

  build(ctx: PromptBuildContext): PromptContribution | null {
    const registry = ctx.registry;
    if (!registry) return null;
    const body = registry.getTemplateRaw('base_agent');
    if (!body) return null;
    // base 模板内可能含 {{#fragment:xxx}} 引用,渲染展开
    const rendered = registry.renderString(body);
    if (!rendered.text.trim()) return null;
    return { content: wrapTagRaw('base', rendered.text), cacheClass: 'stable' };
  }
}
