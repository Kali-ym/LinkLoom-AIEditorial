import { AppError } from '../../domain/errors.js';
import type {
  AiBuildApplyRequest,
  AiBuildCatalog,
  AiBuildDryRunResult,
  AiBuildPlan,
  AiBuildRiskPolicy,
  AiBuildStreamEvent,
  PlanLineage
} from '../../types/aiBuilder.js';
import type { LocalStore } from '../LocalStore.js';
import type { ServiceContext } from '../ServiceContext.js';
import { AiBuildApplyService } from './AiBuildApplyService.js';
import { AiBuilderCatalogService } from './AiBuilderCatalogService.js';
import type { AiBuilderPlanService } from './AiBuilderPlanService.js';
import { AiBuilderPolicySigner } from './AiBuilderPolicySigner.js';
import { sleep } from './aiBuilderRequestUtils.js';
import { deepClone, stableStringify, truncateText } from './AiBuilderUtils.js';
import { AiBuildValidator } from './AiBuildValidator.js';
import { BuilderStateGraphService } from './BuilderStateGraphService.js';

export const DRY_RUN_TOKEN_TTL_MS = 30 * 60 * 1000;
const BUILD_APPLY_POLL_INTERVAL_MS = 25;

export interface StoredDryRunRecord {
  token: string;
  planId: string;
  planVersion: number;
  sanitizedPlan: AiBuildPlan;
  dryRun: AiBuildDryRunResult;
  riskPolicy: AiBuildRiskPolicy;
  createdAt: string;
  expiresAt: string;
}

export class AiBuilderDryRunService {
  private readonly validator = new AiBuildValidator();
  private readonly applyService: AiBuildApplyService;
  private readonly stateGraphService = new BuilderStateGraphService();
  private readonly policySigner: AiBuilderPolicySigner;

  constructor(
    private readonly store: LocalStore,
    context: ServiceContext,
    private readonly catalogService: AiBuilderCatalogService,
    private readonly planService: AiBuilderPlanService
  ) {
    this.applyService = new AiBuildApplyService(store, context);
    this.policySigner = new AiBuilderPolicySigner(
      AiBuilderPolicySigner.defaultSecretProvider(
        () => context.settings,
        () => (typeof (store as any).getDbPath === 'function' ? (store as any).getDbPath() : '')
      )
    );
  }

  async dryRunPlan(plan: AiBuildPlan): Promise<AiBuildDryRunResult> {
    const catalog = await this.catalogService.buildCatalog();
    const prepared = this.preparePlanForApply(plan, catalog, { throwOnInvalid: false });
    const dryRun = this.buildDryRun(prepared, catalog);
    return this.issueDryRunToken(prepared, dryRun);
  }

  preparePlanForApply(
    plan: AiBuildPlan,
    catalog: AiBuildCatalog,
    options?: { throwOnInvalid?: boolean }
  ): AiBuildPlan {
    const sanitized = this.planService.sanitizePlanForTarget(plan);
    sanitized.resourcePolicy = this.planService.trustedResourcePolicyForPlan(sanitized);
    sanitized.validation = this.validator.validatePlan(sanitized, catalog);
    sanitized.dryRun = this.buildDryRun(sanitized, catalog);
    if (options?.throwOnInvalid !== false && sanitized.validation.status !== 'ok') {
      throw new AppError(400, sanitized.validation.errors.join('\n') || 'Plan is not valid');
    }
    return sanitized;
  }

  dryRunRecordKey(planId: string, planVersion = 1) {
    return this.policySigner.dryRunRecordKey(planId, planVersion);
  }

  signDryRunToken(plan: AiBuildPlan, dryRun: AiBuildDryRunResult, expiresAt: string) {
    return this.policySigner.signDryRunToken(plan, dryRun, expiresAt);
  }

  buildRiskPolicy(dryRun: AiBuildDryRunResult, confirmationAccepted = false): AiBuildRiskPolicy {
    return this.policySigner.buildRiskPolicy(dryRun, confirmationAccepted);
  }

  async issueDryRunToken(
    plan: AiBuildPlan,
    dryRun: AiBuildDryRunResult
  ): Promise<AiBuildDryRunResult> {
    const expiresAt = new Date(Date.now() + DRY_RUN_TOKEN_TTL_MS).toISOString();
    const riskPolicy = this.buildRiskPolicy(dryRun);
    const cleanDryRun: AiBuildDryRunResult = {
      planId: dryRun.planId,
      planVersion: dryRun.planVersion,
      changes: deepClone(dryRun.changes),
      warnings: [...dryRun.warnings],
      errors: [...dryRun.errors],
      riskPolicy
    };
    const dryRunToken = this.signDryRunToken(plan, cleanDryRun, expiresAt);
    const returnedDryRun: AiBuildDryRunResult = {
      ...cleanDryRun,
      dryRunToken
    };
    const sanitizedPlanStatus =
      cleanDryRun.errors.length === 0 && plan.validation.status === 'ok'
        ? 'ready'
        : 'pending_validation';
    const sanitizedPlan: AiBuildPlan = {
      ...deepClone(plan),
      status: sanitizedPlanStatus,
      dryRun: undefined
    };
    returnedDryRun.sanitizedPlan = sanitizedPlan;
    const recordDryRun: AiBuildDryRunResult = {
      ...cleanDryRun,
      dryRunToken
    };
    const record: StoredDryRunRecord = {
      token: dryRunToken,
      planId: plan.id,
      planVersion: plan.version || 1,
      sanitizedPlan: {
        ...deepClone(plan),
        status: sanitizedPlanStatus,
        dryRun: recordDryRun
      },
      dryRun: recordDryRun,
      riskPolicy,
      createdAt: new Date().toISOString(),
      expiresAt
    };
    await this.store.put(
      this.dryRunRecordKey(plan.id, plan.version || 1),
      record,
      Math.ceil(DRY_RUN_TOKEN_TTL_MS / 1000)
    );
    return returnedDryRun;
  }

  async resolveDryRunRecord(request: AiBuildApplyRequest): Promise<StoredDryRunRecord> {
    if (!request.planId) throw new AppError(400, 'planId is required');
    if (!request.dryRunToken) throw new AppError(400, 'dryRunToken is required');
    const planVersion = request.planVersion || 1;
    const record = (await this.store.get(this.dryRunRecordKey(request.planId, planVersion))) as
      | StoredDryRunRecord
      | undefined;
    if (!record || record.token !== request.dryRunToken) {
      throw new AppError(
        400,
        'Dry-run token is invalid or missing; run dry-run before confirming write.'
      );
    }
    if (Date.parse(record.expiresAt) <= Date.now()) {
      throw new AppError(
        400,
        'Dry-run token has expired; run dry-run again before confirming write.'
      );
    }
    const expectedToken = this.signDryRunToken(
      record.sanitizedPlan,
      record.dryRun,
      record.expiresAt
    );
    if (expectedToken !== request.dryRunToken) {
      throw new AppError(
        400,
        'Dry-run token signature is invalid; run dry-run again before confirming write.'
      );
    }
    if (request.confirmHighRisk === true && record.riskPolicy.hasHighRisk) {
      const riskPolicy = { ...record.riskPolicy, confirmationAccepted: true };
      const dryRun = { ...record.dryRun, riskPolicy };
      const sanitizedPlan = { ...record.sanitizedPlan, dryRun };
      return { ...record, riskPolicy, dryRun, sanitizedPlan };
    }
    return record;
  }

  buildDryRun(plan: AiBuildPlan, catalog: AiBuildCatalog): AiBuildDryRunResult {
    const warnings: string[] = [
      ...(plan.strippedChanges || []).map((change) => `已移除越权变更：${change}`)
    ];
    const errors = [...(plan.validation?.errors || [])];
    const changes = (plan.resourceChanges || []).map((change) => {
      if (change.action === 'createAgent' || change.action === 'updateAgent') {
        const existing = catalog.agents.find((agent) => agent.id === change.agent.id);
        return {
          action: change.action,
          resourceType: 'agent' as const,
          resourceId: change.agent.id,
          title: change.agent.name || change.agent.id,
          operation: change.action === 'createAgent' ? ('create' as const) : ('update' as const),
          fieldChanges: this.fieldChanges(existing, change.agent as any, [
            'name',
            'description',
            'systemPrompt',
            'providerId',
            'model',
            'temperature',
            'toolIds',
            'skillIds',
            'mcpServerIds',
            'runtime'
          ]),
          riskLevel: change.action === 'updateAgent' ? ('medium' as const) : ('low' as const),
          warnings:
            change.action === 'updateAgent' && !existing
              ? [`将更新不存在的智能体：${change.agent.id}`]
              : []
        };
      }
      if (change.action === 'createWorkflow' || change.action === 'updateWorkflow') {
        const existing = catalog.workflows.find((workflow) => workflow.id === change.workflow.id);
        return {
          action: change.action,
          resourceType: 'workflow' as const,
          resourceId: change.workflow.id,
          title: change.workflow.name || change.workflow.id,
          operation: change.action === 'createWorkflow' ? ('create' as const) : ('update' as const),
          fieldChanges: this.fieldChanges(existing, change.workflow as any, [
            'name',
            'description',
            'initialStepId',
            'inputSpec',
            'outputSpec',
            'steps'
          ]),
          riskLevel: change.action === 'updateWorkflow' ? ('high' as const) : ('medium' as const),
          warnings:
            change.action === 'updateWorkflow' && !existing
              ? [`将更新不存在的工作流：${change.workflow.id}`]
              : []
        };
      }
      return {
        action: change.action,
        resourceType: 'skillFile' as const,
        resourceId: `${change.skillId}/${change.filePath}`,
        title: `${change.skillId}/${change.filePath}`,
        operation: change.action === 'createSkillFile' ? ('create' as const) : ('update' as const),
        fieldChanges: [{ field: 'content', after: truncateText(change.content, 500) }],
        riskLevel: change.action === 'updateSkillFile' ? ('medium' as const) : ('low' as const),
        warnings: []
      };
    });
    return { planId: plan.id, planVersion: plan.version, changes, warnings, errors };
  }

  private fieldChanges(
    before: Record<string, unknown> | undefined,
    after: Record<string, unknown>,
    fields: string[]
  ) {
    return fields
      .filter((field) => Object.prototype.hasOwnProperty.call(after, field))
      .map((field) => ({ field, before: before?.[field], after: after[field] }))
      .filter((change) => stableStringify(change.before) !== stableStringify(change.after));
  }

  private describeBuildChange(change: AiBuildPlan['resourceChanges'][number]) {
    if (change.action === 'createAgent')
      return `正在创建智能体 ${change.agent.name || change.agent.id}`;
    if (change.action === 'updateAgent')
      return `正在更新智能体 ${change.agent.name || change.agent.id}`;
    if (change.action === 'createWorkflow')
      return `正在创建工作流 ${change.workflow.name || change.workflow.id}`;
    if (change.action === 'updateWorkflow')
      return `正在更新工作流 ${change.workflow.name || change.workflow.id}`;
    if (change.action === 'createSkillFile')
      return `正在创建技能文件 ${change.skillId}/${change.filePath}`;
    return `正在更新技能文件 ${change.skillId}/${change.filePath}`;
  }

  async *executeBuild(
    request: AiBuildApplyRequest,
    options?: { signal?: AbortSignal }
  ): AsyncIterable<AiBuildStreamEvent> {
    if (!request || typeof request !== 'object')
      throw new AppError(400, 'build request is required');
    const record = await this.resolveDryRunRecord(request);
    const sanitized = record.sanitizedPlan;
    const dryRun = record.dryRun;
    const total = (sanitized.resourceChanges || []).length + 1;
    const buildLineage: PlanLineage = {
      ...sanitized.lineage,
      planId: sanitized.id,
      planVersion: sanitized.version || 1,
      contractId: sanitized.contract?.id,
      capabilityGraphId: sanitized.capabilityGraph?.id
    };

    yield { type: 'build_start', planId: sanitized.id, total };
    if (sanitized.validation.status !== 'ok') {
      const checkpoint = this.stateGraphService.createCheckpoint({
        type: 'build',
        summary: sanitized.validation.errors.join('\n') || '计划未通过校验，无法构建。',
        state: 'result',
        lineage: buildLineage
      });
      yield {
        type: 'build_failed',
        message: sanitized.validation.errors.join('\n') || '计划未通过校验，无法构建。',
        errors: sanitized.validation.errors,
        lineage: { ...buildLineage, checkpointId: checkpoint.id },
        checkpoint
      };
      return;
    }
    if (dryRun.errors.length > 0) {
      const checkpoint = this.stateGraphService.createCheckpoint({
        type: 'build',
        summary: dryRun.errors.join('\n') || 'Dry-run 存在阻塞错误，无法写库。',
        state: 'result',
        lineage: buildLineage
      });
      yield {
        type: 'build_failed',
        message: dryRun.errors.join('\n') || 'Dry-run 存在阻塞错误，无法写库。',
        errors: dryRun.errors,
        lineage: { ...buildLineage, checkpointId: checkpoint.id },
        checkpoint
      };
      return;
    }
    if (record.riskPolicy.hasHighRisk && request.confirmHighRisk !== true) {
      const checkpoint = this.stateGraphService.createCheckpoint({
        type: 'build',
        summary: 'Dry-run 存在高风险变更，需要用户二次确认。',
        state: 'result',
        lineage: buildLineage
      });
      yield {
        type: 'build_failed',
        message: 'Dry-run 存在高风险变更，需要用户二次确认。',
        errors: ['Dry-run 存在高风险变更，需要用户二次确认。'],
        lineage: { ...buildLineage, checkpointId: checkpoint.id },
        checkpoint
      };
      return;
    }

    try {
      const dryRunCheckpoint = this.stateGraphService.createCheckpoint({
        type: 'dry_run',
        summary: `Dry-run：${dryRun.changes.length} 个变更，${dryRun.errors.length} 个错误`,
        state: 'dryRun',
        lineage: buildLineage,
        riskAccepted: request.confirmHighRisk === true && record.riskPolicy.hasHighRisk
      });
      const dryRunOk =
        dryRun.errors.length === 0 &&
        sanitized.validation.status === 'ok' &&
        (!record.riskPolicy.hasHighRisk || request.confirmHighRisk === true);
      yield {
        type: 'state_graph',
        graph: this.stateGraphService.buildGraph({
          mode: 'build',
          hasDraft: Boolean(buildLineage.draftId),
          hasPlan: true,
          hasDryRun: true,
          dryRunOk,
          contractLocked: sanitized.validation.status === 'ok',
          contractReady: true
        })
      };
      yield {
        type: 'checkpoint',
        checkpoint: {
          ...dryRunCheckpoint,
          lineage: { ...buildLineage, checkpointId: dryRunCheckpoint.id }
        }
      };
      yield {
        type: 'dry_run',
        result: dryRun,
        lineage: { ...buildLineage, checkpointId: dryRunCheckpoint.id },
        checkpoint: dryRunCheckpoint
      };
      yield {
        type: 'state_graph',
        graph: this.stateGraphService.buildGraph({
          mode: 'build',
          hasDraft: Boolean(buildLineage.draftId),
          hasPlan: true,
          hasDryRun: true,
          dryRunOk,
          contractLocked: sanitized.validation.status === 'ok',
          contractReady: true,
          isApplying: true
        })
      };
      const progressQueue: Array<{ step: number; total: number; message: string }> = [];
      let result: Awaited<ReturnType<AiBuildApplyService['applyPlan']>> | undefined;
      let failure: unknown;
      let done = false;
      const applyPromise = this.applyService
        .applyPlan(sanitized, {
          signal: options?.signal,
          onProgress: (progress) => progressQueue.push(progress)
        })
        .then((value) => {
          result = value;
        })
        .catch((error) => {
          failure = error;
        })
        .finally(() => {
          done = true;
        });

      while (!done || progressQueue.length > 0) {
        if (options?.signal?.aborted) break;
        const progress = progressQueue.shift();
        if (progress) {
          yield { type: 'build_progress', ...progress };
        } else {
          await sleep(BUILD_APPLY_POLL_INTERVAL_MS);
        }
      }
      await applyPromise;
      if (options?.signal?.aborted) {
        const checkpoint = this.stateGraphService.createCheckpoint({
          type: 'build',
          summary: '构建已取消',
          state: 'result',
          lineage: buildLineage
        });
        yield {
          type: 'state_graph',
          graph: this.stateGraphService.buildGraph({
            mode: 'build',
            hasDraft: Boolean(buildLineage.draftId),
            hasPlan: true,
            hasDryRun: true,
            dryRunOk,
            contractLocked: sanitized.validation.status === 'ok',
            isFailed: true
          })
        };
        yield {
          type: 'build_failed',
          message: '构建已取消',
          appliedChanges: failure
            ? (failure as { appliedChanges?: string[] }).appliedChanges
            : undefined,
          lineage: { ...buildLineage, checkpointId: checkpoint.id },
          checkpoint
        };
        return;
      }
      if (failure) throw failure instanceof Error ? failure : new Error(String(failure));
      const checkpoint = this.stateGraphService.createCheckpoint({
        type: 'build',
        summary: '构建完成',
        state: 'result',
        lineage: buildLineage,
        riskAccepted: request.confirmHighRisk === true && record.riskPolicy.hasHighRisk
      });
      yield {
        type: 'state_graph',
        graph: this.stateGraphService.buildGraph({
          mode: 'build',
          hasDraft: Boolean(buildLineage.draftId),
          hasPlan: true,
          hasDryRun: true,
          dryRunOk: true,
          contractLocked: true,
          isDone: true
        })
      };
      yield {
        type: 'build_done',
        result: result!,
        lineage: { ...buildLineage, checkpointId: checkpoint.id },
        checkpoint
      };
    } catch (error) {
      if (options?.signal?.aborted) return;
      const appliedChanges = (error as any)?.appliedChanges as string[] | undefined;
      const checkpoint = this.stateGraphService.createCheckpoint({
        type: 'build',
        summary: `构建失败：${error instanceof Error ? error.message : String(error)}`,
        state: 'result',
        lineage: buildLineage,
        riskAccepted: request.confirmHighRisk === true && record.riskPolicy.hasHighRisk,
        partialWriteRisk: Boolean(appliedChanges?.length)
      });
      yield {
        type: 'state_graph',
        graph: this.stateGraphService.buildGraph({
          mode: 'build',
          hasDraft: Boolean(buildLineage.draftId),
          hasPlan: true,
          hasDryRun: true,
          isFailed: true
        })
      };
      yield {
        type: 'build_failed',
        message: error instanceof Error ? error.message : String(error),
        appliedChanges,
        lineage: { ...buildLineage, checkpointId: checkpoint.id },
        checkpoint
      };
    }
  }
}
