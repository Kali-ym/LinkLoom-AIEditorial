import { createHmac } from 'crypto';
import type {
  AiBuildDryRunResult,
  AiBuildPlan,
  AiBuildResourcePolicy,
  AiBuildRiskPolicy
} from '../../types/aiBuilder.js';
import { stableStringify } from './AiBuilderUtils.js';

/**
 * AiBuilder 的策略签名 / Dry-run 令牌签发模块。
 *
 * 之前散落在 `AiBuilderService` 内部的 `resourcePolicySecret` / `signDryRunToken` /
 * `signResourcePolicy` / `verifyResourcePolicy` / `buildRiskPolicy` / `dryRunRecordKey`
 * 都聚集到这里，给主服务收窄到单一职责，并方便单测（只需 mock secret 提供函数）。
 */
export class AiBuilderPolicySigner {
  /**
   * @param secretProvider 返回签名密钥。默认实现应优先读取 env、settings、dbPath。
   */
  constructor(private readonly secretProvider: () => string) {}

  static defaultSecretProvider(getSettings: () => unknown, getDbPath: () => string): () => string {
    return () => {
      const settings = getSettings() as Record<string, unknown> | undefined;
      const dbPath = getDbPath();
      const envSecret = process.env.AI_BUILDER_POLICY_SECRET;
      if (
        process.env.NODE_ENV === 'production' &&
        !envSecret &&
        !(settings as any)?.AI_BUILDER_POLICY_SECRET
      ) {
        throw new Error('生产环境必须设置 AI_BUILDER_POLICY_SECRET。');
      }
      return String(
        envSecret || (settings as any)?.AI_BUILDER_POLICY_SECRET || dbPath || 'linkloom-ai-builder'
      );
    };
  }

  dryRunRecordKey(planId: string, planVersion = 1): string {
    return `aiBuilder.dryRun.${planId}.v${planVersion}`;
  }

  /** 计算 dry-run token 的签名 payload（用于二次校验签名是否一致）。 */
  dryRunTokenPayload(
    plan: Pick<AiBuildPlan, 'id' | 'target' | 'mode' | 'version'>,
    dryRun: AiBuildDryRunResult,
    expiresAt: string
  ) {
    return {
      planId: plan.id,
      planVersion: plan.version || 1,
      target: plan.target,
      mode: plan.mode,
      expiresAt,
      riskPolicy: dryRun.riskPolicy,
      changesHash: createHmac('sha256', this.secret())
        .update(stableStringify(dryRun.changes))
        .digest('hex')
    };
  }

  signDryRunToken(plan: AiBuildPlan, dryRun: AiBuildDryRunResult, expiresAt: string): string {
    const payload = this.dryRunTokenPayload(plan, dryRun, expiresAt);
    return createHmac('sha256', this.secret()).update(stableStringify(payload)).digest('hex');
  }

  buildRiskPolicy(dryRun: AiBuildDryRunResult, confirmationAccepted = false): AiBuildRiskPolicy {
    const highRiskChangeIds = dryRun.changes
      .filter((change) => change.riskLevel === 'high')
      .map((change) => `${change.action}:${change.resourceId}`);
    return {
      hasHighRisk: highRiskChangeIds.length > 0,
      highRiskChangeIds,
      requiresConfirmation: highRiskChangeIds.length > 0,
      confirmationAccepted
    };
  }

  signResourcePolicy(
    plan: Pick<AiBuildPlan, 'id' | 'target' | 'mode'>,
    policy: Omit<AiBuildResourcePolicy, 'signature'>
  ): AiBuildResourcePolicy {
    const signaturePayload = {
      planId: plan.id,
      target: plan.target,
      mode: plan.mode,
      reusePolicy: policy.reusePolicy,
      allowResourceCreation: policy.allowResourceCreation,
      reason: policy.reason,
      source: policy.source
    };
    const signature = createHmac('sha256', this.secret())
      .update(stableStringify(signaturePayload))
      .digest('hex');
    return { ...policy, signature };
  }

  verifyResourcePolicy(
    plan: Pick<AiBuildPlan, 'id' | 'target' | 'mode'>,
    policy: AiBuildResourcePolicy
  ): boolean {
    if (!policy.signature) return false;
    const { signature: _signature, ...unsigned } = policy;
    return this.signResourcePolicy(plan, unsigned).signature === policy.signature;
  }

  private secret(): string {
    return this.secretProvider();
  }
}
