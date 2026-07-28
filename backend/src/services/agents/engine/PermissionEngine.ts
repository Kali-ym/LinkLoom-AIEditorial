import type {
  PermissionActionKind,
  PermissionDecision,
  PermissionEffect,
  PermissionPolicy,
  PermissionRequest,
  PermissionRiskLevel,
  PermissionSubject
} from './PermissionPolicy.js';

export interface PermissionDecisionInput {
  runId: string;
  sessionId: string;
  policy?: PermissionPolicy;
  subject: PermissionSubject;
  arguments: unknown;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface PermissionDecisionResult {
  request: PermissionRequest;
  decision: PermissionDecision;
}

export class PermissionPauseError extends Error {
  constructor(public readonly request: PermissionRequest) {
    super(`Permission required for tool "${request.subject.toolName}"`);
    this.name = 'PermissionPauseError';
  }
}

export function isPermissionPauseError(error: unknown): error is PermissionPauseError {
  return error instanceof PermissionPauseError;
}

export class DefaultPermissionEngine {
  decide(input: PermissionDecisionInput): PermissionDecisionResult {
    const subject = normalizePermissionSubject(input.subject);
    const policy = input.policy ?? { defaultEffect: 'allow' };
    const effect = this.resolveEffect(policy, subject);
    const now = new Date().toISOString();
    const request: PermissionRequest = {
      permissionId: createPermissionId(input.runId, subject.toolName),
      runId: input.runId,
      sessionId: input.sessionId,
      subject,
      arguments: input.arguments,
      reason: input.reason,
      requestedAt: now,
      metadata: input.metadata
    };

    return {
      request,
      decision: {
        permissionId: request.permissionId,
        effect,
        reason: this.resolveReason(policy, subject, effect),
        resolvedBy: effect === 'ask' ? 'human' : 'policy',
        resolvedAt: now,
        metadata: {
          actionKind: subject.actionKind,
          riskLevel: subject.riskLevel
        }
      }
    };
  }

  private resolveEffect(policy: PermissionPolicy, subject: PermissionSubject): PermissionEffect {
    if (policy.readonlyMode && isWriteLikeAction(subject.actionKind)) {
      return 'deny';
    }

    if (policy.simulateMode && isWriteLikeAction(subject.actionKind)) {
      return 'deny';
    }

    const matched = policy.rules?.find((rule) => matchesSubject(rule.match, subject));
    if (matched) return matched.effect;

    return policy.defaultEffect;
  }

  private resolveReason(
    policy: PermissionPolicy,
    subject: PermissionSubject,
    effect: PermissionEffect
  ): string {
    const matched = policy.rules?.find((rule) => matchesSubject(rule.match, subject));
    if (matched?.reason) return matched.reason;
    if (effect === 'allow') return 'Permission policy allowed this tool call.';
    if (effect === 'ask') return 'Permission policy requires human approval.';
    return 'Permission policy denied this tool call.';
  }
}

export function createDefaultPermissionPolicy(): PermissionPolicy {
  return createPlatformPermissionPolicy();
}

export function createPlatformPermissionPolicy(): PermissionPolicy {
  return {
    defaultEffect: 'allow',
    requireReasonForAsk: true,
    rules: [
      {
        id: 'publish-require-approval',
        match: { actionKind: 'publish' },
        effect: 'ask',
        reason: '发布类操作需要人工审批。'
      },
      {
        id: 'execute-command-require-approval',
        match: { actionKind: 'execute_command' },
        effect: 'ask',
        reason: '命令执行需要人工审批。'
      },
      {
        id: 'delete-require-approval',
        match: { actionKind: 'delete' },
        effect: 'ask',
        reason: '删除操作需要人工审批。'
      },
      {
        id: 'write-require-approval',
        match: { actionKind: 'write' },
        effect: 'ask',
        reason: '写入操作需要人工审批。'
      },
      {
        id: 'network-require-approval',
        match: { actionKind: 'network' },
        effect: 'ask',
        reason: '外部网络请求需要人工确认。'
      },
      {
        id: 'critical-risk-approval',
        match: { riskLevel: 'critical' },
        effect: 'ask',
        reason: '极高风险工具需要人工审批。'
      },
      {
        id: 'readonly-tools-allow',
        match: { actionKind: 'read' },
        effect: 'allow',
        reason: '只读工具默认允许。'
      },
      {
        id: 'query-tools-allow',
        match: { actionKind: 'query' },
        effect: 'allow',
        reason: '查询工具默认允许。'
      }
    ],
    metadata: { policyVersion: 'platform-v1' }
  };
}

export function previewPermissionEffect(
  policy: PermissionPolicy,
  subject: PermissionSubject
): PermissionDecisionResult {
  return new DefaultPermissionEngine().decide({
    runId: 'preview',
    sessionId: 'preview',
    policy,
    subject,
    arguments: {}
  });
}

export function normalizePermissionSubject(subject: PermissionSubject): PermissionSubject {
  const actionKind = subject.actionKind ?? (subject.toolName ? inferActionKind(subject.toolName) : 'unknown');
  return {
    ...subject,
    actionKind,
    riskLevel: subject.riskLevel ?? inferRiskLevel(actionKind)
  };
}

export function inferActionKind(toolName: string): PermissionActionKind {
  const normalized = toolName.toLowerCase().replace(/-/g, '_');
  if (normalized === 'ask_user_question' || normalized === 'askuserquestion') return 'read';
  if (normalized.includes('delete') || normalized.includes('remove')) return 'delete';
  if (normalized.includes('publish') || normalized.includes('send')) return 'publish';
  if (normalized.includes('build_daily') || normalized.includes('report_json')) return 'publish';
  if (normalized === 'execute_command' || normalized.includes('command') || normalized.includes('exec')) {
    return 'execute_command';
  }
  if (
    normalized.includes('save') ||
    normalized.includes('write') ||
    normalized.includes('create') ||
    normalized.includes('edit')
  ) {
    return 'write';
  }
  if (normalized.includes('query') || normalized.includes('search') || normalized.includes('list')) {
    return 'query';
  }
  if (normalized.includes('read') || normalized.includes('get') || normalized.includes('inspect')) {
    return 'read';
  }
  if (normalized.includes('fetch') || normalized.includes('http') || normalized.includes('request')) {
    return 'network';
  }
  return 'unknown';
}

export function inferRiskLevel(actionKind: PermissionActionKind): PermissionRiskLevel {
  if (actionKind === 'delete' || actionKind === 'execute_command') return 'critical';
  if (actionKind === 'publish' || actionKind === 'write') return 'high';
  if (actionKind === 'network' || actionKind === 'unknown') return 'medium';
  return 'low';
}

function matchesSubject(match: Partial<PermissionSubject>, subject: PermissionSubject): boolean {
  return Object.entries(match).every(([key, value]) => {
    if (value === undefined) return true;
    return subject[key as keyof PermissionSubject] === value;
  });
}

function isWriteLikeAction(actionKind: PermissionActionKind | undefined): boolean {
  return (
    actionKind === 'write' ||
    actionKind === 'delete' ||
    actionKind === 'publish' ||
    actionKind === 'execute_command'
  );
}

function createPermissionId(runId: string, toolName: string): string {
  return `perm_${runId}_${toolName}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}