import { AppError } from '../../domain/errors.js';
import type {
  AiBuildCatalog,
  AiBuildChatRequest,
  AiBuildChatMessage,
  AiBuildStreamEvent,
  BuilderMode,
  AiBuilderMention,
  AiBuildMode,
  AiBuildPlan,
  AiBuildRequest,
  AiBuildTarget,
  BuilderContextMemory,
  PlanDraft,
  PlanLineage
} from '../../types/aiBuilder.js';
import { createAIProvider, type AIProvider } from '../AIProvider.js';
import type { ServiceContext } from '../ServiceContext.js';
import { AiBuilderCatalogService } from './AiBuilderCatalogService.js';
import type { AiBuilderDryRunService } from './AiBuilderDryRunService.js';
import type { AiBuilderPlanService } from './AiBuilderPlanService.js';
import { lastUserText, mentionTarget } from './aiBuilderRequestUtils.js';
import { extractJsonObject, truncateText } from './AiBuilderUtils.js';
import { AiBuildValidator } from './AiBuildValidator.js';
import { BuilderStateGraphService } from './BuilderStateGraphService.js';
import { CapabilityGraphBuilder } from './CapabilityGraphBuilder.js';
import { PlanContractService } from './PlanContractService.js';
import {
  chatSystemPromptFor,
  PLAN_FROM_CHAT_HINT,
  SUMMARY_SYSTEM_HINT,
  systemPromptFor,
  targetLabelForSeed
} from './prompts/aiBuilderPrompts.js';

export class AiBuilderChatService {
  private readonly validator = new AiBuildValidator();
  private readonly stateGraphService = new BuilderStateGraphService();
  private readonly capabilityGraphBuilder = new CapabilityGraphBuilder();
  private readonly planContractService = new PlanContractService();

  constructor(
    private readonly context: ServiceContext,
    private readonly catalogService: AiBuilderCatalogService,
    private readonly planService: AiBuilderPlanService,
    private readonly dryRunService: AiBuilderDryRunService
  ) {}

  async *streamChat(
    body: AiBuildChatRequest,
    options?: { signal?: AbortSignal }
  ): AsyncIterable<AiBuildStreamEvent> {
    if (!body || typeof body !== 'object') throw new AppError(400, 'request body is required');
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      throw new AppError(400, 'messages are required');
    }

    const catalog = await this.catalogService.buildCatalog();
    const compactCatalog = this.catalogService.compactCatalog(catalog);
    const inferred = this.inferRequest(body);
    const builderMode = this.effectiveBuilderMode(body);
    const planPhase = body.planPhase || (body.buildRequested === true ? 'generate' : 'discover');
    if (body.compressRequested === true) {
      const provider = this.resolveProvider(body);
      const { summary, memory } = await this.generateContextSummary(body, provider, options);
      if (options?.signal?.aborted) return;
      yield { type: 'context_summary', summary };
      yield { type: 'context_memory', summary, memory };
      return;
    }

    if (inferred.needsMention && (builderMode === 'plan' || builderMode === 'build')) {
      yield {
        type: 'needs_input',
        message:
          builderMode === 'build'
            ? '请先从计划草稿进入构建，或用 @ 指定要创建/修改的对象。'
            : '请先用 @ 引用“创建 智能体 / 创建 技能 / 创建 工作流”或现有资源，再进入计划。'
      };
      return;
    }

    this.planService.validateRequest(inferred.request);
    const prompt = {
      ...this.buildPromptForRequest(
        inferred.request,
        builderMode === 'build' || (builderMode === 'plan' && planPhase === 'generate')
      ),
      inferredIntent: inferred.explanation,
      mentions: inferred.mentions,
      contextSummary: body.contextSummary || '',
      contextMemory: body.contextMemory,
      currentPlan: body.currentPlan,
      currentDraft: body.currentDraft,
      stateGraph: body.stateGraph,
      capabilityGraph: body.capabilityGraph,
      planContract: body.planContract,
      lineage: body.lineage,
      planAnswers: body.planAnswers || {},
      builderMode,
      planPhase,
      catalog: compactCatalog,
      conversation: this.compactMessages(body.messages)
    };

    yield { type: 'status', message: '读取可用智能体、技能、工具和工作流...' };
    yield {
      type: 'status',
      message:
        builderMode === 'plan'
          ? '正在像 Cursor Plan 一样澄清目标并整理方案...'
          : builderMode === 'build'
            ? '正在把方案草稿转换为可构建计划...'
            : inferred.needsMention
              ? '等待你用 @ 指定要创建或修改的对象...'
              : '分析目标并准备澄清问题...'
    };

    const provider = this.resolveProvider(body);

    if (builderMode === 'plan') {
      const draft = await this.planService.generatePlanDraft(
        inferred.request,
        prompt,
        provider,
        options,
        planPhase
      );
      if (options?.signal?.aborted) return;

      if (draft.questions.length > 0 && planPhase !== 'generate') {
        yield { type: 'planning_questions', questions: draft.questions };
        const questionCheckpoint = this.stateGraphService.createCheckpoint({
          type: 'questions',
          summary: `待澄清 ${draft.questions.length} 个问题`,
          state: 'plan',
          lineage: body.lineage,
          answers: body.planAnswers || {}
        });
        yield {
          type: 'state_graph',
          graph: this.stateGraphService.buildGraph({
            mode: 'plan',
            hasDraft: false,
            contractReady: false
          })
        };
        yield { type: 'checkpoint', checkpoint: questionCheckpoint };
        return;
      }

      const finalizedDraft: PlanDraft =
        planPhase === 'generate' ? { ...draft, questions: [], status: 'ready_for_build' } : draft;
      const capabilityGraph = this.capabilityGraphBuilder.fromDraft(finalizedDraft, catalog);
      const planContract = this.planContractService.fromDraft(
        inferred.request,
        finalizedDraft,
        capabilityGraph
      );
      const lineage: PlanLineage = {
        draftId: finalizedDraft.id,
        draftVersion: finalizedDraft.version || 1,
        contractId: planContract.id,
        capabilityGraphId: capabilityGraph.id,
        parentCheckpointId: body.lineage?.checkpointId
      };
      const stateGraph = this.stateGraphService.buildGraph({
        mode: 'plan',
        hasDraft: true,
        contractReady: planContract.status !== 'draft' && finalizedDraft.status !== 'needs_input'
      });
      const checkpoint = this.stateGraphService.createCheckpoint({
        type: 'plan_draft',
        summary: finalizedDraft.summary,
        state: 'plan',
        lineage,
        answers: body.planAnswers || {}
      });
      const enrichedLineage: PlanLineage = { ...lineage, checkpointId: checkpoint.id };
      const enrichedDraft: PlanDraft = {
        ...finalizedDraft,
        stateGraph,
        capabilityGraph,
        contract: planContract,
        lineage: enrichedLineage
      };
      yield { type: 'state_graph', graph: stateGraph };
      yield { type: 'capability_graph', graph: capabilityGraph };
      yield { type: 'plan_contract', contract: planContract };
      yield { type: 'checkpoint', checkpoint: { ...checkpoint, lineage: enrichedLineage } };
      yield { type: 'plan_draft', draft: enrichedDraft };
      return;
    }

    if (builderMode === 'build') {
      try {
        if (options?.signal?.aborted) return;
        const generated = await this.generateChatPlanWithFallback(
          inferred.request,
          prompt,
          catalog,
          provider,
          body.currentPlan?.id,
          options
        );
        if (options?.signal?.aborted) return;
        const prepared = this.dryRunService.preparePlanForApply(generated, catalog, {
          throwOnInvalid: false
        });
        const basePlan = this.enrichPlanArchitecture(
          prepared,
          inferred.request,
          catalog,
          body.currentDraft,
          body.lineage
        );
        const checkpoint = this.stateGraphService.createCheckpoint({
          type: 'plan',
          summary: basePlan.summary,
          state: 'build',
          lineage: basePlan.lineage
        });
        const plan: AiBuildPlan = {
          ...basePlan,
          lineage: { ...basePlan.lineage, checkpointId: checkpoint.id }
        };
        yield {
          type: 'state_graph',
          graph:
            plan.stateGraph ||
            this.stateGraphService.buildGraph({ mode: 'build', hasDraft: true, hasPlan: true })
        };
        if (plan.capabilityGraph) yield { type: 'capability_graph', graph: plan.capabilityGraph };
        if (plan.contract) yield { type: 'plan_contract', contract: plan.contract };
        yield { type: 'checkpoint', checkpoint: { ...checkpoint, lineage: plan.lineage } };
        yield { type: 'plan', plan };
      } catch (error) {
        if (options?.signal?.aborted) return;
        const fallback = this.planService.buildFallbackPlan(
          inferred.request,
          catalog,
          error instanceof Error ? error.message : String(error)
        );
        fallback.validation = this.validator.validatePlan(fallback, catalog);
        const prepared = this.dryRunService.preparePlanForApply(fallback, catalog, {
          throwOnInvalid: false
        });
        const basePlan = this.enrichPlanArchitecture(
          prepared,
          inferred.request,
          catalog,
          body.currentDraft,
          body.lineage
        );
        const checkpoint = this.stateGraphService.createCheckpoint({
          type: 'plan',
          summary: basePlan.summary,
          state: 'build',
          lineage: basePlan.lineage
        });
        const plan: AiBuildPlan = {
          ...basePlan,
          lineage: { ...basePlan.lineage, checkpointId: checkpoint.id }
        };
        yield {
          type: 'state_graph',
          graph:
            plan.stateGraph ||
            this.stateGraphService.buildGraph({ mode: 'build', hasDraft: true, hasPlan: true })
        };
        if (plan.capabilityGraph) yield { type: 'capability_graph', graph: plan.capabilityGraph };
        if (plan.contract) yield { type: 'plan_contract', contract: plan.contract };
        yield { type: 'checkpoint', checkpoint: { ...checkpoint, lineage: plan.lineage } };
        yield { type: 'plan', plan };
      }
      return;
    }

    let fullText = '';
    if (provider.streamContent) {
      const stream = provider.streamContent(
        JSON.stringify(prompt, null, 2),
        [],
        chatSystemPromptFor(inferred.request.target),
        options
      );
      for await (const chunk of stream) {
        if (options?.signal?.aborted) return;
        const content = chunk.content || '';
        if (!content) continue;
        fullText += content;
        yield { type: 'delta', content };
      }
    } else {
      const response = await provider.generateContent(
        JSON.stringify(prompt, null, 2),
        [],
        chatSystemPromptFor(inferred.request.target),
        options
      );
      if (options?.signal?.aborted) return;
      fullText = response.content || '';
      if (fullText) yield { type: 'delta', content: fullText };
    }

    yield { type: 'needs_input', message: '继续对话完善需求；准备好后切换到计划模式发送。' };
  }

  effectiveBuilderMode(body: AiBuildChatRequest): BuilderMode {
    if (
      body.builderMode === 'chat' ||
      body.builderMode === 'plan' ||
      body.builderMode === 'build'
    ) {
      return body.builderMode;
    }
    return body.buildRequested === true ? 'build' : 'chat';
  }

  async generateChatPlanWithFallback(
    request: AiBuildRequest,
    prompt: unknown,
    catalog: AiBuildCatalog,
    provider: AIProvider,
    existingPlanId?: string,
    options?: { signal?: AbortSignal }
  ): Promise<AiBuildPlan> {
    const systemInstruction = `${systemPromptFor(request.target)}\n${PLAN_FROM_CHAT_HINT}`;
    let raw: unknown;
    try {
      raw = await this.callAiWithSystem(
        request.target,
        prompt,
        systemInstruction,
        provider,
        options
      );
    } catch (error) {
      if (options?.signal?.aborted) throw error;
      raw = this.planService.buildPlanSeedFromRequest(
        request,
        catalog,
        error instanceof Error ? error.message : String(error)
      );
    }
    const normalized = await this.planService.normalizePlan(raw, request, catalog, existingPlanId);
    normalized.validation = this.validator.validatePlan(normalized, catalog);
    return normalized;
  }

  compactMessages(messages: AiBuildChatMessage[]): AiBuildChatMessage[] {
    return messages
      .filter((message) => message.content && message.content.trim())
      .slice(-10)
      .map((message) => ({
        role: message.role,
        content: truncateText(message.content, 1400)
      }));
  }

  buildPromptForRequest(request: AiBuildRequest, buildRequested?: boolean) {
    return {
      request: {
        ...request,
        reusePolicy:
          request.reusePolicy ||
          (request.target === 'workflow' ? 'preferExisting' : 'existingOnly'),
        allowResourceCreation: request.allowResourceCreation === true,
        resourceCreationReason: request.resourceCreationReason || '',
        resourcePolicy: request.resourcePolicy || null,
        buildRequested: buildRequested === true
      },
      resourceCreationPolicy: {
        target: request.target,
        reusePolicy:
          request.reusePolicy ||
          (request.target === 'workflow' ? 'preferExisting' : 'existingOnly'),
        allowResourceCreation: request.allowResourceCreation === true,
        reason: request.resourceCreationReason || '',
        allowedResourceChangeActions:
          this.planService.allowedResourceChangeActionsForRequest(request),
        instructions:
          request.target === 'workflow'
            ? request.allowResourceCreation === true
              ? '可以在工作流计划中创建缺失的智能体或技能，但仍应优先复用 catalog；每个新资源都必须有明确必要性。'
              : '只能复用 catalog 中已有资源来构建工作流；如果现有资源不足，请在 questions 中请求用户确认是否允许新建智能体或技能。'
            : `${targetLabelForSeed(request.target)}构建器只能创建或修改自身资源，不允许产生其他资源类型。`
      }
    };
  }

  async callAi(target: AiBuildTarget, promptObject: unknown): Promise<unknown> {
    return this.callAiWithSystem(target, promptObject, systemPromptFor(target));
  }

  async callAiWithSystem(
    target: AiBuildTarget,
    promptObject: unknown,
    systemInstruction: string,
    provider = this.context.aiProvider,
    options?: { signal?: AbortSignal }
  ): Promise<unknown> {
    if (!provider) throw new Error('AI Provider not configured');
    const response = await provider.generateContent(
      JSON.stringify(promptObject, null, 2),
      [],
      systemInstruction,
      options
    );
    const content = response.content || '';
    try {
      return extractJsonObject(content);
    } catch {
      if (options?.signal?.aborted) throw new Error('Request aborted');
      const retry = await provider.generateContent(
        `The previous response was not valid JSON. Return only valid JSON for this request:\n${JSON.stringify(promptObject, null, 2)}\nPrevious response:\n${truncateText(content, 2000)}`,
        [],
        systemInstruction,
        options
      );
      return extractJsonObject(retry.content || '');
    }
  }

  inferRequest(body: AiBuildChatRequest): {
    request: AiBuildRequest;
    mentions: AiBuilderMention[];
    needsMention: boolean;
    explanation: string;
  } {
    const mentions = this.normalizeMentions(body);
    const primary = mentions.find(
      (mention) =>
        mention.type === 'create' ||
        mention.type === 'agent' ||
        mention.type === 'skill' ||
        mention.type === 'workflow'
    );
    const userGoal = lastUserText(body.messages) || body.request?.goal || 'AI Builder conversation';
    const base: AiBuildRequest = {
      target: body.request?.target || 'workflow',
      mode: body.request?.mode || 'create',
      resourceId: body.request?.resourceId,
      goal: userGoal,
      inputSchema: body.request?.inputSchema,
      outputRequirement: body.request?.outputRequirement,
      outputSchema: body.request?.outputSchema,
      constraints: body.request?.constraints,
      reusePolicy: body.request?.reusePolicy || 'preferExisting',
      allowResourceCreation: body.request?.allowResourceCreation,
      resourceCreationReason: body.request?.resourceCreationReason,
      resourcePolicy: body.request?.resourcePolicy
    };

    if (!primary) {
      return {
        request: base,
        mentions,
        needsMention: true,
        explanation:
          'No @ mention was supplied; ask the user to reference a create action or an existing resource before planning.'
      };
    }

    const target = mentionTarget(primary) || base.target;
    const mode: AiBuildMode = primary.type === 'create' ? 'create' : 'update';
    const resourceId = mode === 'update' ? primary.id : undefined;
    const resourceCreation = this.planService.inferResourceCreationPolicy(
      target,
      mode,
      mentions,
      userGoal,
      body.request,
      body.planAnswers
    );
    return {
      request: {
        ...base,
        target,
        mode,
        resourceId,
        goal: userGoal,
        reusePolicy: resourceCreation.reusePolicy,
        allowResourceCreation: resourceCreation.allowResourceCreation,
        resourceCreationReason: resourceCreation.reason
      },
      mentions,
      needsMention: false,
      explanation:
        mode === 'create'
          ? `Primary @ mention requests creating a ${target}.`
          : `Primary @ mention requests updating ${target}:${resourceId || '<missing id>'}.`
    };
  }

  private normalizeMentions(
    body: Pick<AiBuildChatRequest, 'mentions' | 'messages'>
  ): AiBuilderMention[] {
    const merged = [
      ...(Array.isArray(body.mentions) ? body.mentions : []),
      ...body.messages.flatMap((message) =>
        Array.isArray(message.mentions) ? message.mentions : []
      )
    ];
    const seen = new Set<string>();
    return merged
      .filter((mention) => mention && typeof mention === 'object')
      .filter((mention) => {
        const key = `${mention.type}:${mention.target || ''}:${mention.id || ''}:${mention.label || ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((mention) => ({
        type: mention.type,
        target: mention.target,
        id: mention.id,
        label: String(mention.label || mention.id || mention.target || mention.type),
        description: mention.description ? String(mention.description) : undefined
      }));
  }

  private async generateContextSummary(
    body: AiBuildChatRequest,
    provider: AIProvider,
    options?: { signal?: AbortSignal }
  ): Promise<{ summary: string; memory: BuilderContextMemory }> {
    const fallbackMemory = this.buildDeterministicMemory(body);
    const prompt = {
      existingSummary: body.contextSummary || '',
      existingMemory: body.contextMemory,
      mentions: this.normalizeMentions(body),
      currentPlan: body.currentPlan,
      conversation: this.compactMessages(body.messages).map((message) => ({
        role: message.role,
        content: truncateText(message.content, 2000)
      }))
    };
    try {
      const response = await provider.generateContent(
        JSON.stringify(prompt, null, 2),
        [],
        SUMMARY_SYSTEM_HINT,
        options
      );
      try {
        const parsed = extractJsonObject(
          response.content || ''
        ) as Partial<BuilderContextMemory> & { summary?: string };
        const memory = this.normalizeContextMemory(
          { ...fallbackMemory, ...parsed },
          fallbackMemory
        );
        return {
          summary: truncateText(
            parsed.summary || memory.goalSummary || response.content || '',
            4000
          ),
          memory
        };
      } catch {
        return {
          summary: truncateText(response.content || fallbackMemory.goalSummary, 4000),
          memory: fallbackMemory
        };
      }
    } catch {
      return { summary: fallbackMemory.goalSummary, memory: fallbackMemory };
    }
  }

  private buildDeterministicMemory(body: AiBuildChatRequest): BuilderContextMemory {
    const mentions = this.normalizeMentions(body);
    const currentPlan = body.currentPlan;
    const recentTurns = this.compactMessages(body.messages).slice(-6);
    const lastGoal = lastUserText(body.messages);
    const decisions = Object.entries(body.planAnswers || {}).map(([id, value]) => ({
      id,
      label: id,
      value,
      source: 'planAnswers'
    }));
    if (currentPlan?.resourcePolicy) {
      decisions.push({
        id: 'resourcePolicy',
        label: '资源创建策略',
        value: {
          reusePolicy: currentPlan.resourcePolicy.reusePolicy,
          allowResourceCreation: currentPlan.resourcePolicy.allowResourceCreation,
          reason: currentPlan.resourcePolicy.reason
        },
        source: 'resourcePolicy'
      });
    }
    return {
      goalSummary: truncateText(
        lastGoal || currentPlan?.summary || body.contextSummary || 'AI Builder 会话',
        800
      ),
      decisions,
      openQuestions: (currentPlan?.questions || []).map((question, index) =>
        typeof question === 'string'
          ? { id: `q_${index}`, prompt: question, answered: false }
          : {
              id: question.id || `q_${index}`,
              prompt: question.prompt,
              required: question.required,
              answered: body.planAnswers?.[question.id] !== undefined
            }
      ),
      resourceRefs: mentions.map((mention) => ({
        type: mention.type,
        target: mention.target,
        id: mention.id,
        label: mention.label,
        purpose: mention.description
      })),
      planState: currentPlan
        ? {
            activePlanId: currentPlan.id,
            activePlanVersion: currentPlan.version || 1,
            activePlanStatus: currentPlan.status,
            summary: currentPlan.summary
          }
        : undefined,
      buildState: currentPlan?.status
        ? {
            status: currentPlan.status,
            partialWriteRisk: currentPlan.status === 'failed'
          }
        : undefined,
      recentTurns,
      sourceMessageRange: {
        start: Math.max(0, body.messages.length - recentTurns.length),
        end: body.messages.length
      },
      sourceArtifactIds: currentPlan ? [currentPlan.id] : [],
      updatedAt: new Date().toISOString()
    };
  }

  private normalizeContextMemory(
    candidate: Partial<BuilderContextMemory>,
    fallback: BuilderContextMemory
  ): BuilderContextMemory {
    return {
      goalSummary: truncateText(String(candidate.goalSummary || fallback.goalSummary || ''), 800),
      decisions: Array.isArray(candidate.decisions) ? candidate.decisions : fallback.decisions,
      openQuestions: Array.isArray(candidate.openQuestions)
        ? candidate.openQuestions
        : fallback.openQuestions,
      resourceRefs: Array.isArray(candidate.resourceRefs)
        ? candidate.resourceRefs
        : fallback.resourceRefs,
      planState: candidate.planState || fallback.planState,
      buildState: candidate.buildState || fallback.buildState,
      recentTurns: Array.isArray(candidate.recentTurns)
        ? candidate.recentTurns.slice(-8)
        : fallback.recentTurns,
      sourceMessageRange: candidate.sourceMessageRange || fallback.sourceMessageRange,
      sourceArtifactIds: Array.isArray(candidate.sourceArtifactIds)
        ? candidate.sourceArtifactIds
        : fallback.sourceArtifactIds,
      updatedAt: new Date().toISOString()
    };
  }

  resolveProvider(body: Pick<AiBuildChatRequest, 'providerId' | 'model'>): AIProvider {
    const providerId = String(body.providerId || '').trim();
    const model = String(body.model || '').trim();
    if (!providerId && !model) {
      if (!this.context.aiProvider) throw new AppError(500, 'AI Provider not configured');
      return this.context.aiProvider;
    }

    const settings = this.context.settings as any;
    const providers = settings?.AI_PROVIDERS || [];
    const config = providerId
      ? providers.find((provider: any) => provider.id === providerId)
      : providers.find((provider: any) => provider.id === settings?.ACTIVE_AI_PROVIDER_ID) ||
        providers[0];
    if (!config) throw new AppError(400, `AI provider not found: ${providerId || '<default>'}`);
    const created = createAIProvider(
      { ...config, model: config.models?.[0] || model || config.model },
      this.context.proxyAgent
    );
    if (!created)
      throw new AppError(400, `AI provider is not supported: ${config.type || config.id}`);
    return created;
  }

  enrichPlanArchitecture(
    plan: AiBuildPlan,
    request: AiBuildRequest,
    catalog: AiBuildCatalog,
    currentDraft?: PlanDraft,
    parentLineage?: PlanLineage
  ): AiBuildPlan {
    const capabilityGraph = this.capabilityGraphBuilder.fromPlan(plan, catalog);
    const contract = this.planContractService.fromPlan(request, plan, capabilityGraph);
    const preparedForGraph = plan.dryRun ? plan : { ...plan, dryRun: plan.dryRun };
    const stateGraph = this.stateGraphService.buildGraph({
      mode: 'build',
      hasDraft: Boolean(currentDraft),
      hasPlan: true,
      hasDryRun: Boolean(plan.dryRun),
      dryRunOk: plan.dryRun ? this.dryRunIsOk(preparedForGraph) : undefined,
      contractLocked: contract.status === 'locked',
      contractReady: contract.status !== 'draft'
    });
    const lineage: PlanLineage = {
      draftId: currentDraft?.id || parentLineage?.draftId,
      draftVersion: currentDraft?.version || parentLineage?.draftVersion,
      planId: plan.id,
      planVersion: plan.version || 1,
      contractId: contract.id,
      capabilityGraphId: capabilityGraph.id,
      parentCheckpointId: parentLineage?.checkpointId || parentLineage?.parentCheckpointId
    };
    return { ...plan, stateGraph, capabilityGraph, contract, lineage };
  }

  private dryRunIsOk(plan: AiBuildPlan): boolean {
    if (!plan.dryRun) return false;
    if ((plan.dryRun.errors?.length || 0) > 0) return false;
    if (plan.validation.status !== 'ok') return false;
    return Boolean(plan.dryRun.dryRunToken);
  }

  private extractPlanFromChat(text: string): unknown | null {
    const markerIndex = text.lastIndexOf('AI_BUILD_PLAN_JSON');
    const searchArea = markerIndex >= 0 ? text.slice(markerIndex) : text;
    const fenced = searchArea.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]?.trim()) {
      try {
        return extractJsonObject(fenced[1]);
      } catch {
        // fall through to whole-text extraction
      }
    }
    try {
      return extractJsonObject(searchArea);
    } catch {
      return null;
    }
  }

  parsePlanFromTextForTest(text: string): unknown | null {
    return this.extractPlanFromChat(text);
  }
}
