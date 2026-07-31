export type {
  AssembledPromptContribution,
  AssembledMessages,
  FewShotExample,
  ModelHints,
  PromptBuildContext,
  PromptCacheClass,
  PromptContribution,
  PromptPhase,
  PromptProvider,
  StructuredPrompt
} from './types.js';
export { normalizeSystemPrompt } from './normalizeSystemPrompt.js';
export { expandStructuredPrompt } from './expandStructuredPrompt.js';
export { sanitizeXml, wrapTag, wrapTagRaw } from './sanitize.js';
export { PromptPipeline } from './PromptPipeline.js';
export { isCanUseFC, isCanUseVision } from './ModelCapabilities.js';
export { RoleProvider } from './providers/RoleProvider.js';
export { BaseAgentProvider } from './providers/BaseAgentProvider.js';
export { IdentityProvider } from './providers/IdentityProvider.js';
export { CapabilitiesProvider } from './providers/CapabilitiesProvider.js';
export { ConstraintsProvider } from './providers/ConstraintsProvider.js';
export { OutputFormatProvider } from './providers/OutputFormatProvider.js';
export { ExamplesProvider } from './providers/ExamplesProvider.js';
export { SkillProvider } from './providers/SkillProvider.js';
export type { SkillServiceLike } from './providers/SkillProvider.js';
export { ModelHintProvider } from './providers/ModelHintProvider.js';
export { ToolSystemProvider } from './providers/ToolSystemProvider.js';
export { DateContextProvider } from './providers/DateContextProvider.js';
export { KnowledgeContextProvider } from './providers/KnowledgeContextProvider.js';
export { MemoryContextProvider } from './providers/MemoryContextProvider.js';
export { TodoHintProvider } from './providers/TodoHintProvider.js';
export { buildPromptPipelineContext, assembleSystemMessages } from './assemble.js';
export type { BuildContextInput } from './assemble.js';
export { replaceMessageVariables } from './replaceMessageVariables.js';

// Registry(P3):集中注册/解析/渲染模板与片段
export type {
  DocRefResolver,
  PromptFragmentMeta,
  PromptTemplateMeta,
  RenderOptions,
  RenderResult
} from './registry/types.js';
export { PromptRegistry } from './registry/PromptRegistry.js';
export {
  loadPromptAssetsFromDir,
  parsePromptMarkdown
} from './registry/FragmentLoader.js';
export type { LoadedAssets } from './registry/FragmentLoader.js';
export {
  renderTemplate,
  scanFragmentRefs,
  scanVariables
} from './registry/templateEngine.js';
