/** Agent Console 展示与布局字段 — 随智能体定义存储。 */
export interface AgentConsoleUiMetadata {
  welcome?: string;
  openingQuestions?: string[];
  gradient?: string;
  /** 在 Console 侧栏展示；省略时为 true。 */
  consoleVisible?: boolean;
  /** 主智能体（侧栏置顶、默认 @）；同一部署建议仅一个为 true。 */
  isPrimary?: boolean;
}

export function mergeAgentConsoleUiMetadata(
  existingMetadata: Record<string, unknown> | undefined,
  defaults: AgentConsoleUiMetadata | undefined,
): Record<string, unknown> | undefined {
  if (!defaults) return existingMetadata;

  const metadata = { ...(existingMetadata ?? {}) };

  const existingUi =
    metadata.ui && typeof metadata.ui === 'object'
      ? (metadata.ui as AgentConsoleUiMetadata)
      : {};

  const nextUi: AgentConsoleUiMetadata = {
    ...defaults,
    ...(existingUi.welcome?.trim() ? { welcome: existingUi.welcome } : {}),
    ...(existingUi.openingQuestions?.length
      ? { openingQuestions: existingUi.openingQuestions }
      : {}),
    ...(existingUi.gradient?.trim() ? { gradient: existingUi.gradient } : {}),
    ...(existingUi.consoleVisible !== undefined
      ? { consoleVisible: existingUi.consoleVisible }
      : {}),
    ...(existingUi.isPrimary !== undefined ? { isPrimary: existingUi.isPrimary } : {}),
  };

  metadata.ui = nextUi;
  return metadata;
}
