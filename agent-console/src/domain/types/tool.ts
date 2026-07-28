export type ToolState =
  | 'executing'
  | 'pending'
  | 'success'
  | 'error'
  | 'warning'
  | 'rejected'
  | 'aborted';

export interface ToolPayload {
  id?: string;
  plugin?: string;
  identifier?: string;
  api?: string;
  apiName?: string;
  /** Stable LinkLoom tool id from tool identity mapper. */
  linkloomToolId?: string;
  customTitle?: string;
  params?: Record<string, unknown>;
  arguments?: Record<string, unknown>;
  url?: string;
  state?: ToolState;
  duration?: string;
  resultText?: string;
  error?: string;
  rejectedReason?: string;
  hidePortal?: boolean;
  debug?: string;
  args?: Record<string, unknown>;
  intervention?: { status: 'pending' | 'resolved' };
  /** Backend permission id — distinct from LLM toolCallId. */
  permissionId?: string;
  toolCallId?: string;
  /** §C.26 — builtin 自定义 Render 可切换 */
  hasBuiltinRender?: boolean;
  /** §C.26 — collapsed | expand | alwaysExpand */
  renderDisplayControl?: 'collapsed' | 'expand' | 'alwaysExpand';
  /** §C.26 — PluginDetailModal schema */
  settingsSchema?: Record<string, unknown>;
  /** §C.43 — 流式参数原始 JSON 字符串（partial JSON） */
  argumentsRaw?: string;
  /** §C.43 — 显式标记参数仍在流式生成 */
  isArgumentsStreaming?: boolean;
  /** §C.43 — 是否有 builtin StreamingRenderer */
  hasStreamingRenderer?: boolean;
  /** §C.45 — tool message result content */
  resultContent?: string;
  /** §C.45 — plugin execution state for RunCommand / Linear / etc. */
  pluginState?: unknown;
  /** Runtime HITL (SSE hitl_required) — not builtin tool registry */
  hitlKind?: string;
  hitlPrompt?: string;
  allowedActions?: string[];
  hitlSchema?: unknown;
}
