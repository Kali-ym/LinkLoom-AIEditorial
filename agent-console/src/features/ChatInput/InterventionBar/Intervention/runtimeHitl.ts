export const RUNTIME_HITL_KINDS = [
  'needs_input',
  'argument_edit',
  'confirmation',
  'external_execution',
] as const;

export type RuntimeHitlKind = (typeof RUNTIME_HITL_KINDS)[number];

export function isRuntimeHitlKind(value?: string): value is RuntimeHitlKind {
  return Boolean(value && (RUNTIME_HITL_KINDS as readonly string[]).includes(value));
}

export function defaultAllowedActionsForKind(kind: string): string[] {
  switch (kind) {
    case 'needs_input':
      return ['provide_input', 'cancel'];
    case 'external_execution':
      return ['external_result', 'cancel'];
    case 'argument_edit':
      return ['allow', 'deny', 'edit_arguments', 'cancel'];
    case 'confirmation':
      return ['allow', 'deny', 'cancel'];
    default:
      return ['cancel'];
  }
}

export const RUNTIME_HITL_ACTION_LABELS: Record<string, string> = {
  provide_input: '提交',
  external_result: '提交结果',
  edit_arguments: '保存参数',
  allow: '批准',
  deny: '拒绝',
  cancel: '取消',
};
