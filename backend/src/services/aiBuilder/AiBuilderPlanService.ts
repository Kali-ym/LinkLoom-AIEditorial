import { AppError } from '../../domain/errors.js';
import type { AgentDefinition } from '../../types/agent.js';
import type {
  AiBuildCatalog,
  AiBuildMode,
  AiBuildPlan,
  AiBuildRequest,
  AiBuildResourcePolicy,
  AiBuildTarget,
  AiBuilderMention,
  PlanDraft,
  PlanQuestion,
  PlanQuestionOption,
  PlanningQuestion,
  WorkflowPlan
} from '../../types/aiBuilder.js';
import { createAIProvider, type AIProvider } from '../AIProvider.js';
import type { LocalStore } from '../LocalStore.js';
import type { ServiceContext } from '../ServiceContext.js';
import { AiBuilderCatalogService } from './AiBuilderCatalogService.js';
import type { AiBuilderChatService } from './AiBuilderChatService.js';
import { AiBuilderPolicySigner } from './AiBuilderPolicySigner.js';
import {
  lastUserText,
  mentionsRequestNewCapabilities,
  reusePolicyFromPlanAnswers,
  textAllowsNewCapabilities,
  textForbidsNewCapabilities,
  yesLike
} from './aiBuilderRequestUtils.js';
import {
  deepClone,
  ensureUniqueId,
  extractJsonObject,
  isPlainObject,
  slugifyId,
  stableStringify,
  truncateText
} from './AiBuilderUtils.js';
import { AiBuildValidator } from './AiBuildValidator.js';
import {
  PLAN_DRAFT_SYSTEM_HINT,
  systemPromptFor,
  targetLabelForSeed
} from './prompts/aiBuilderPrompts.js';
import { WorkflowPlanCompiler } from './WorkflowPlanCompiler.js';

export class AiBuilderPlanService {
  private readonly compiler = new WorkflowPlanCompiler();
  private readonly validator = new AiBuildValidator();
  private readonly policySigner: AiBuilderPolicySigner;
  private chatService?: AiBuilderChatService;

  constructor(
    private readonly catalogService: AiBuilderCatalogService,
    context: ServiceContext,
    store: LocalStore
  ) {
    this.policySigner = new AiBuilderPolicySigner(
      AiBuilderPolicySigner.defaultSecretProvider(
        () => context.settings,
        () => (typeof (store as any).getDbPath === 'function' ? (store as any).getDbPath() : '')
      )
    );
  }

  bindChatService(chatService: AiBuilderChatService) {
    this.chatService = chatService;
  }

  private chat() {
    if (!this.chatService) throw new Error('AiBuilderChatService not bound');
    return this.chatService;
  }

  async createPlan(request: AiBuildRequest): Promise<AiBuildPlan> {
    request = this.prepareRequestForPlanning(request);
    this.validateRequest(request);
    const catalog = await this.catalogService.buildCatalog();
    const generated = await this.generatePlanWithAi(request, catalog);
    const normalized = await this.normalizePlan(generated, request, catalog);
    normalized.validation = this.validator.validatePlan(normalized, catalog);
    return normalized;
  }

  async revisePlan(body: {
    request?: AiBuildRequest;
    plan?: AiBuildPlan;
    feedback?: string;
  }): Promise<AiBuildPlan> {
    if (!body.plan) throw new AppError(400, 'plan is required');
    const inferredResourceId = this.inferResourceIdFromPlan(body.plan);
    const request: AiBuildRequest = {
      target: body.request?.target || body.plan.target,
      mode: body.request?.mode || body.plan.mode,
      resourceId: body.request?.resourceId || inferredResourceId,
      goal: body.request?.goal || body.feedback || 'Revise the current plan',
      inputSchema: body.request?.inputSchema,
      outputRequirement: body.request?.outputRequirement,
      outputSchema: body.request?.outputSchema,
      constraints: body.request?.constraints,
      reusePolicy: body.request?.reusePolicy,
      allowResourceCreation: body.request?.allowResourceCreation,
      resourceCreationReason: body.request?.resourceCreationReason
    };
    const preparedRequest = this.prepareRequestForPlanning(request);
    const catalog = await this.catalogService.buildCatalog();
    const prompt = {
      ...this.chat().buildPromptForRequest(preparedRequest),
      feedback: body.feedback || '',
      currentPlan: body.plan,
      catalog
    };
    const generated = await this.chat().callAi(preparedRequest.target, prompt);
    const normalized = await this.normalizePlan(generated, preparedRequest, catalog, body.plan.id);
    normalized.validation = this.validator.validatePlan(normalized, catalog);
    return normalized;
  }

  validateRequest(request: AiBuildRequest) {
    if (!request || typeof request !== 'object')
      throw new AppError(400, 'request body is required');
    if (!['agent', 'skill', 'workflow'].includes(request.target))
      throw new AppError(400, 'target is invalid');
    if (!['create', 'update'].includes(request.mode)) throw new AppError(400, 'mode is invalid');
    if (!String(request.goal || '').trim()) throw new AppError(400, 'goal is required');
    if (request.mode === 'update' && !request.resourceId)
      throw new AppError(400, 'resourceId is required for update');
  }

  async generatePlanDraft(
    request: AiBuildRequest,
    prompt: Record<string, unknown>,
    provider: AIProvider,
    options?: { signal?: AbortSignal },
    planPhase: 'discover' | 'generate' = 'discover'
  ): Promise<PlanDraft> {
    try {
      const response = await provider.generateContent(
        JSON.stringify(
          {
            ...prompt,
            request,
            instruction:
              planPhase === 'generate'
                ? '用户已通过澄清问题给出 planAnswers。请输出完整 PlanDraft，questions 必须为空数组，并基于已确认答案完善 proposedResources、decisions、workflowOutline。'
                : 'Plan 模式只输出 PlanDraft，不输出 AiBuildPlan。若信息不足，优先提出 questions，不要输出完整方案细节。'
          },
          null,
          2
        ),
        [],
        PLAN_DRAFT_SYSTEM_HINT,
        options
      );
      const parsed = extractJsonObject(response.content || '{}') as Record<string, unknown>;
      return this.normalizePlanDraft(parsed, request);
    } catch (error) {
      return this.fallbackPlanDraft(
        request,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private normalizePlanDraft(raw: Record<string, unknown>, request: AiBuildRequest): PlanDraft {
    const questions = Array.isArray(raw.questions)
      ? (raw.questions
          .map((question, index) => this.normalizePlanningQuestion(question, index))
          .filter(Boolean) as PlanningQuestion[])
      : [];
    return {
      id: String(
        raw.id || `draft_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
      ),
      target: request.target,
      mode: request.mode,
      title: String(raw.title || raw.summary || this.defaultSummary(request)),
      summary: String(raw.summary || this.defaultSummary(request)),
      assumptions: Array.isArray(raw.assumptions)
        ? raw.assumptions.map(String).filter(Boolean)
        : [],
      decisions: Array.isArray(raw.decisions)
        ? raw.decisions
            .map((item: any, index) => ({
              id: String(item?.id || `decision_${index + 1}`),
              label: String(item?.label || item?.id || `决策 ${index + 1}`),
              value: String(item?.value || ''),
              confidence: ['low', 'medium', 'high'].includes(item?.confidence)
                ? item.confidence
                : undefined
            }))
            .filter((item) => item.value)
        : [],
      questions,
      proposedResources: Array.isArray(raw.proposedResources)
        ? raw.proposedResources.map((item: any) => ({
            type: ['agent', 'skill', 'workflow', 'tool', 'mcp'].includes(item?.type)
              ? item.type
              : request.target,
            name: String(item?.name || '待定资源'),
            action: ['reuse', 'create', 'update'].includes(item?.action) ? item.action : 'reuse',
            reason: String(item?.reason || ''),
            ref: item?.ref ? String(item.ref) : undefined
          }))
        : [],
      workflowOutline: isPlainObject(raw.workflowOutline)
        ? (raw.workflowOutline as unknown as WorkflowPlan)
        : undefined,
      risks: Array.isArray(raw.risks) ? raw.risks.map(String).filter(Boolean) : [],
      nextSteps: Array.isArray(raw.nextSteps)
        ? raw.nextSteps.map(String).filter(Boolean)
        : ['回答问题后继续完善方案', '确认方案后进入构建模式'],
      version: Number(raw.version || 1),
      status: questions.length > 0 ? 'needs_input' : 'ready_for_build'
    };
  }

  private normalizePlanningQuestion(raw: unknown, index: number): PlanningQuestion | null {
    if (!raw || typeof raw !== 'object') return null;
    const obj = raw as any;
    const options: PlanQuestionOption[] = Array.isArray(obj.options)
      ? obj.options
          .map((option: any, optionIndex: number) => ({
            id: String(option?.id || `option_${optionIndex + 1}`),
            label: String(option?.label || option?.id || `选项 ${optionIndex + 1}`),
            description: option?.description ? String(option.description) : undefined
          }))
          .filter((option: PlanQuestionOption) => option.label)
      : [];
    const hasCustom = options.some((option) => option.id === 'custom');
    const normalizedOptions = hasCustom
      ? options.filter(
          (option, optionIndex) =>
            option.id !== 'custom' ||
            optionIndex === options.findIndex((item) => item.id === 'custom')
        )
      : [...options, { id: 'custom', label: '其他 / 自定义输入', description: '我想自己补充答案' }];
    if (normalizedOptions[normalizedOptions.length - 1]?.id !== 'custom') {
      const custom = normalizedOptions.find((option) => option.id === 'custom') || {
        id: 'custom',
        label: '其他 / 自定义输入',
        description: '我想自己补充答案'
      };
      return {
        id: String(obj.id || `question_${index + 1}`),
        prompt: String(obj.prompt || `问题 ${index + 1}`),
        type: ['single', 'multi', 'text', 'confirm'].includes(obj.type) ? obj.type : 'single',
        required: obj.required !== false,
        options: [...normalizedOptions.filter((option) => option.id !== 'custom'), custom],
        defaultOptionId: obj.defaultOptionId ? String(obj.defaultOptionId) : undefined,
        customOptionId: 'custom'
      };
    }
    return {
      id: String(obj.id || `question_${index + 1}`),
      prompt: String(obj.prompt || `问题 ${index + 1}`),
      type: ['single', 'multi', 'text', 'confirm'].includes(obj.type) ? obj.type : 'single',
      required: obj.required !== false,
      options: normalizedOptions,
      defaultOptionId: obj.defaultOptionId ? String(obj.defaultOptionId) : undefined,
      customOptionId: 'custom'
    };
  }

  private fallbackPlanDraft(request: AiBuildRequest, reason: string): PlanDraft {
    return this.normalizePlanDraft(
      {
        title: this.defaultSummary(request),
        summary: `${this.defaultSummary(request)}。我需要先确认几个关键决策，再进入构建。`,
        assumptions: [
          reason ? `模型规划失败，已生成保守草稿：${reason}` : '先确认目标边界和复用策略'
        ],
        questions: [
          {
            id: 'desired_output',
            prompt: '你希望最终交付的能力输出什么结果？',
            type: 'single',
            required: true,
            options: [
              {
                id: 'structured',
                label: '结构化结果',
                description: '例如 JSON、字段映射或可验证输出'
              },
              { id: 'text', label: '自然语言结果', description: '例如摘要、报告或说明文本' },
              { id: 'custom', label: '其他 / 自定义输入', description: '我自己描述输出要求' }
            ]
          },
          {
            id: 'reuse_policy',
            prompt: '资源策略应该如何处理？',
            type: 'single',
            required: true,
            options: [
              {
                id: 'existingOnly',
                label: '只复用现有资源',
                description: '不创建新的智能体或技能'
              },
              { id: 'preferExisting', label: '优先复用，必要时再问我', description: '默认更稳妥' },
              { id: 'allowCreate', label: '允许创建缺失资源', description: '适合新工作流或新能力' },
              { id: 'custom', label: '其他 / 自定义输入', description: '我自己说明资源策略' }
            ]
          }
        ],
        proposedResources: [],
        risks: ['进入构建前需要确认输出和资源策略'],
        nextSteps: ['回答问题', '继续完善方案', '确认后进入构建']
      },
      request
    );
  }

  sanitizePlanForTarget(plan: AiBuildPlan): AiBuildPlan {
    const next = deepClone(plan);
    const warnings = Array.isArray(next.warnings) ? [...next.warnings] : [];
    const stripped: string[] = [];
    const keep = (action: string) => {
      if (next.target === 'agent')
        return action === (next.mode === 'update' ? 'updateAgent' : 'createAgent');
      if (next.target === 'skill')
        return action === (next.mode === 'update' ? 'updateSkillFile' : 'createSkillFile');
      if (
        next.target === 'workflow' &&
        (action === 'createAgent' ||
          action === 'createSkillFile' ||
          action === 'updateAgent' ||
          action === 'updateSkillFile')
      ) {
        return this.trustedResourcePolicyForPlan(next).allowResourceCreation === true;
      }
      return true;
    };
    next.resourceChanges = (next.resourceChanges || []).filter((change) => {
      if (keep(change.action)) return true;
      stripped.push(change.action);
      return false;
    });
    if ((next.target === 'agent' || next.target === 'skill') && next.workflowPlan) {
      stripped.push('workflowPlan');
      delete next.workflowPlan;
    }
    if (stripped.length > 0) {
      const unique = Array.from(new Set(stripped));
      next.strippedChanges = unique;
      const warning = `已移除越权变更：${unique.join(', ')}（当前为${targetLabelForSeed(next.target)}构建）`;
      if (!warnings.includes(warning)) warnings.push(warning);
    }
    next.warnings = warnings;
    return next;
  }

  trustedResourcePolicyForPlan(plan: AiBuildPlan): AiBuildResourcePolicy {
    const fallback: AiBuildResourcePolicy = {
      reusePolicy: plan.target === 'workflow' ? 'preferExisting' : 'existingOnly',
      allowResourceCreation: false,
      reason:
        plan.target === 'workflow'
          ? '缺少服务端签名的资源创建授权，按只复用现有资源处理'
          : `${targetLabelForSeed(plan.target)}构建器只能修改自身资源`,
      source: 'server'
    };
    if (plan.target !== 'workflow') return this.signResourcePolicy(plan, fallback);

    const policy = plan.resourcePolicy;
    if (!policy || policy.source !== 'server' || !this.verifyResourcePolicy(plan, policy)) {
      return this.signResourcePolicy(plan, fallback);
    }
    return policy;
  }

  signResourcePolicy(
    plan: Pick<AiBuildPlan, 'id' | 'target' | 'mode'>,
    policy: Omit<AiBuildResourcePolicy, 'signature'>
  ): AiBuildResourcePolicy {
    return this.policySigner.signResourcePolicy(plan, policy);
  }

  verifyResourcePolicy(
    plan: Pick<AiBuildPlan, 'id' | 'target' | 'mode'>,
    policy: AiBuildResourcePolicy
  ) {
    return this.policySigner.verifyResourcePolicy(plan, policy);
  }

  prepareRequestForPlanning(request: AiBuildRequest): AiBuildRequest {
    const resourceCreation = this.inferResourceCreationPolicy(
      request.target,
      request.mode,
      [],
      request.goal,
      request
    );
    return {
      ...request,
      reusePolicy: resourceCreation.reusePolicy,
      allowResourceCreation: resourceCreation.allowResourceCreation,
      resourceCreationReason: resourceCreation.reason
    };
  }

  inferResourceIdFromPlan(plan: AiBuildPlan): string | undefined {
    if (plan.mode !== 'update') return undefined;
    if (plan.target === 'agent') {
      const change = plan.resourceChanges.find((item) => item.action === 'updateAgent') as any;
      return change?.agent?.id;
    }
    if (plan.target === 'skill') {
      const change = plan.resourceChanges.find((item) => item.action === 'updateSkillFile') as any;
      return change?.skillId;
    }
    if (plan.target === 'workflow') {
      const change = plan.resourceChanges.find((item) => item.action === 'updateWorkflow') as any;
      return change?.workflow?.id;
    }
    return undefined;
  }

  async generatePlanWithAi(request: AiBuildRequest, catalog: AiBuildCatalog): Promise<unknown> {
    const prompt = {
      ...this.chat().buildPromptForRequest(request),
      catalog
    };
    try {
      return await this.chat().callAi(request.target, prompt);
    } catch (error) {
      return this.buildFallbackPlan(
        request,
        catalog,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  buildPlanSeedFromRequest(
    request: AiBuildRequest,
    catalog: AiBuildCatalog,
    reason: string
  ): unknown {
    const targetName = request.goal.slice(0, 32) || targetLabelForSeed(request.target);
    const warning = `AI 没有返回可解析计划，已生成可继续编辑的草稿：${reason}`;
    if (request.target === 'agent') {
      const agentId =
        request.mode === 'update' && request.resourceId
          ? request.resourceId
          : slugifyId(targetName, 'agent');
      return {
        summary: `${request.mode === 'update' ? '修改' : '创建'}智能体：${targetName}`,
        questions: [],
        warnings: [warning],
        resourceChanges: [
          {
            action: request.mode === 'update' ? 'updateAgent' : 'createAgent',
            agent: {
              id: agentId,
              name: targetName,
              description: request.goal,
              systemPrompt: `你是${targetName}。请根据输入完成目标：${request.goal}\n\n输出要求：如果用户指定 JSON schema，必须严格输出可解析 JSON。`,
              providerId: catalog.defaults.providerId,
              model: catalog.defaults.model,
              temperature: 0.3,
              toolIds: [],
              skillIds: [],
              mcpServerIds: [],
              metadata: {
                aiBuilder: {
                  generatedBy: 'agent-builder',
                  contract: {
                    inputSchema: request.inputSchema,
                    outputSchema: request.outputSchema
                  }
                }
              }
            }
          }
        ]
      };
    }

    if (request.target === 'skill') {
      const skillId =
        request.mode === 'update' && request.resourceId
          ? request.resourceId
          : slugifyId(targetName, 'skill');
      return {
        summary: `${request.mode === 'update' ? '修改' : '创建'}技能：${targetName}`,
        questions: [],
        warnings: [warning],
        resourceChanges: [
          {
            action: request.mode === 'update' ? 'updateSkillFile' : 'createSkillFile',
            skillId,
            filePath: 'SKILL.md',
            content: `---\nname: ${targetName}\ndescription: ${request.goal}\n---\n\n# ${targetName}\n\n## Instructions\n\n${request.goal}\n`
          }
        ]
      };
    }

    if (request.allowResourceCreation !== true) {
      const existingAgentId = catalog.agents[0]?.id;
      const workflowPlan: WorkflowPlan = {
        name: targetName,
        description: request.goal,
        inputSchema: request.inputSchema,
        outputSchema: request.outputSchema,
        steps: [
          {
            id: 'step_1',
            goal: request.goal,
            kind: 'agent',
            consumes: ['input'],
            produces: ['result'],
            resourceRef: existingAgentId ? `agent:${existingAgentId}` : undefined
          }
        ]
      };
      const workflow = existingAgentId
        ? this.compiler.compile(workflowPlan, { catalog })
        : undefined;
      return {
        summary: `${request.mode === 'update' ? '修改' : '创建'}工作流：${targetName}`,
        questions: existingAgentId
          ? []
          : ['当前没有可复用的智能体。是否允许为这个工作流新建智能体能力？'],
        warnings: [
          warning,
          request.resourceCreationReason || '默认只复用现有资源，不自动创建智能体或技能'
        ],
        workflowPlan,
        resourceChanges: workflow
          ? [{ action: request.mode === 'update' ? 'updateWorkflow' : 'createWorkflow', workflow }]
          : []
      };
    }

    const agentId = slugifyId(`${targetName}_agent`, 'agent');
    return {
      summary: `${request.mode === 'update' ? '修改' : '创建'}工作流：${targetName}`,
      questions: [],
      warnings: [warning],
      workflowPlan: {
        name: targetName,
        description: request.goal,
        inputSchema: request.inputSchema,
        outputSchema: request.outputSchema,
        steps: [
          {
            id: 'step_1',
            goal: request.goal,
            kind: 'agent',
            consumes: ['input'],
            produces: ['result'],
            resourceRef: `agent:${agentId}`,
            needsNewAgent: true
          }
        ]
      },
      resourceChanges: [
        {
          action: 'createAgent',
          agent: {
            id: agentId,
            name: `${targetName}智能体`,
            description: request.goal,
            systemPrompt: `你是${targetName}智能体。请根据工作流输入完成目标：${request.goal}`,
            providerId: catalog.defaults.providerId,
            model: catalog.defaults.model,
            temperature: 0.3,
            toolIds: [],
            skillIds: [],
            mcpServerIds: [],
            metadata: {
              aiBuilder: {
                generatedBy: 'workflow-builder',
                contract: { inputSchema: request.inputSchema, outputSchema: request.outputSchema }
              }
            }
          }
        }
      ]
    };
  }

  async normalizePlan(
    raw: unknown,
    request: AiBuildRequest,
    catalog: AiBuildCatalog,
    existingPlanId?: string
  ): Promise<AiBuildPlan> {
    const obj = isPlainObject(raw) ? raw : {};
    const planId =
      existingPlanId ||
      `build_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const coerced = this.coercePlanToRequestScope(obj, request, catalog);
    const resourceChanges = Array.isArray(coerced.resourceChanges) ? coerced.resourceChanges : [];
    const workflowPlan = isPlainObject(coerced.workflowPlan)
      ? (coerced.workflowPlan as unknown as WorkflowPlan)
      : undefined;

    const normalized: AiBuildPlan = {
      id: String(coerced.id || planId),
      target: request.target,
      mode: request.mode,
      summary: String(coerced.summary || this.defaultSummary(request)),
      questions: Array.isArray(coerced.questions)
        ? coerced.questions
            .map((question) =>
              isPlainObject(question)
                ? (question as unknown as PlanQuestion)
                : String(question || '').trim()
            )
            .filter(Boolean)
        : [],
      warnings: Array.isArray(coerced.warnings) ? coerced.warnings.map(String).filter(Boolean) : [],
      resourceChanges: deepClone(resourceChanges) as AiBuildPlan['resourceChanges'],
      workflowPlan,
      validation: { status: 'invalid', errors: [] }
    };

    this.attachResourcePolicy(normalized, request);
    this.fillDefaults(normalized, request, catalog);
    this.compileWorkflowPlanIfNeeded(normalized, request, catalog);
    return normalized;
  }

  private attachResourcePolicy(plan: AiBuildPlan, request: AiBuildRequest) {
    const policy: Omit<AiBuildResourcePolicy, 'signature'> = {
      reusePolicy:
        request.reusePolicy || (request.target === 'workflow' ? 'preferExisting' : 'existingOnly'),
      allowResourceCreation:
        request.target === 'workflow' && request.allowResourceCreation === true,
      reason:
        request.resourceCreationReason ||
        (request.target === 'workflow'
          ? '默认优先复用现有资源'
          : `${targetLabelForSeed(request.target)}构建器只能修改自身资源`),
      source: 'server'
    };
    plan.resourcePolicy = this.signResourcePolicy(plan, policy);
    if (request.target !== 'workflow') return;
    if (request.allowResourceCreation === true) {
      const warning = `用户已明确允许工作流新建缺失能力：${request.resourceCreationReason || '未提供具体原因'}`;
      if (!plan.warnings.includes(warning)) plan.warnings.push(warning);
    } else if (request.resourceCreationReason) {
      const warning = `工作流资源策略：${request.resourceCreationReason}`;
      if (!plan.warnings.includes(warning)) plan.warnings.push(warning);
    }
  }

  private coercePlanToRequestScope(
    obj: Record<string, unknown>,
    request: AiBuildRequest,
    catalog: AiBuildCatalog
  ): Record<string, unknown> {
    const warnings = Array.isArray(obj.warnings) ? obj.warnings.map(String).filter(Boolean) : [];
    const allChanges = Array.isArray(obj.resourceChanges) ? obj.resourceChanges : [];
    const addScopeWarning = (message: string) => {
      if (!warnings.includes(message)) warnings.push(message);
    };

    if (request.target === 'agent') {
      const expected = request.mode === 'update' ? 'updateAgent' : 'createAgent';
      let agentChange = allChanges.find(
        (change) => change?.action === expected && isPlainObject(change.agent)
      );
      if (!agentChange) {
        const anyAgent = allChanges.find(
          (change) =>
            (change?.action === 'createAgent' || change?.action === 'updateAgent') &&
            isPlainObject(change.agent)
        );
        if (anyAgent?.agent) {
          agentChange = { action: expected, agent: anyAgent.agent };
          addScopeWarning('模型生成了越界计划，已自动收敛为智能体变更。');
        }
      }
      if (!agentChange) {
        const seed = this.buildPlanSeedFromRequest(
          request,
          catalog,
          '模型没有生成合法智能体变更'
        ) as Record<string, unknown>;
        return {
          ...seed,
          warnings: [...warnings, ...((seed.warnings as string[]) || [])]
        };
      }
      const agent = deepClone(agentChange.agent);
      if (request.mode === 'update' && request.resourceId) {
        agent.id = request.resourceId;
      }
      this.sanitizeAgentReferencesForScopedPlan(agent, catalog, warnings);
      if (
        agentChange.action !== expected ||
        allChanges.length !== 1 ||
        isPlainObject(obj.workflowPlan)
      ) {
        addScopeWarning('已丢弃智能体构建范围外的技能或工作流变更。');
      }
      return {
        ...obj,
        target: request.target,
        mode: request.mode,
        workflowPlan: undefined,
        resourceChanges: [{ action: expected, agent }],
        warnings
      };
    }

    if (request.target === 'skill') {
      const expected = request.mode === 'update' ? 'updateSkillFile' : 'createSkillFile';
      let skillChange = allChanges.find((change) => change?.action === expected);
      if (!skillChange) {
        const anySkill = allChanges.find(
          (change) => change?.action === 'createSkillFile' || change?.action === 'updateSkillFile'
        );
        if (anySkill) {
          skillChange = { ...anySkill, action: expected };
          addScopeWarning('模型生成了越界计划，已自动收敛为技能文件变更。');
        }
      }
      if (!skillChange) {
        const seed = this.buildPlanSeedFromRequest(
          request,
          catalog,
          '模型没有生成合法技能变更'
        ) as Record<string, unknown>;
        return {
          ...seed,
          warnings: [...warnings, ...((seed.warnings as string[]) || [])]
        };
      }
      const scopedSkillChange = deepClone(skillChange);
      scopedSkillChange.action = expected;
      if (request.mode === 'update' && request.resourceId) {
        scopedSkillChange.skillId = request.resourceId;
      }
      if (
        skillChange.action !== expected ||
        allChanges.length !== 1 ||
        isPlainObject(obj.workflowPlan)
      ) {
        addScopeWarning('已丢弃技能构建范围外的智能体或工作流变更。');
      }
      return {
        ...obj,
        target: request.target,
        mode: request.mode,
        workflowPlan: undefined,
        resourceChanges: [scopedSkillChange],
        warnings
      };
    }

    if (request.target === 'workflow') {
      const allowed = new Set(this.allowedResourceChangeActionsForRequest(request));
      const scopedChanges = allChanges.filter((change) => allowed.has(change?.action));
      if (scopedChanges.length !== allChanges.length) {
        addScopeWarning(
          request.allowResourceCreation === true
            ? '已丢弃工作流构建范围外的资源变更。'
            : '已按当前策略丢弃模型擅自生成的新智能体或技能；如需新建能力，请明确说明允许新建。'
        );
      }
      const workflowPlan = this.sanitizeWorkflowPlanForResourcePolicy(
        obj.workflowPlan,
        request,
        catalog,
        warnings
      );
      const next: Record<string, unknown> = {
        ...obj,
        target: request.target,
        mode: request.mode,
        resourceChanges: scopedChanges,
        workflowPlan,
        warnings
      };
      if (
        !isPlainObject(obj.workflowPlan) &&
        !scopedChanges.some(
          (change) => change.action === 'createWorkflow' || change.action === 'updateWorkflow'
        )
      ) {
        const seed = this.buildPlanSeedFromRequest(
          request,
          catalog,
          '模型没有生成合法工作流变更'
        ) as Record<string, unknown>;
        return {
          ...seed,
          warnings: [...warnings, ...((seed.warnings as string[]) || [])]
        };
      }
      return next;
    }

    return obj;
  }

  private sanitizeAgentReferencesForScopedPlan(
    agent: Record<string, unknown>,
    catalog: AiBuildCatalog,
    warnings: string[]
  ) {
    const existingToolIds = new Set(catalog.tools.map((tool) => tool.id));
    const existingSkillIds = new Set(catalog.skills.map((skill) => skill.id));
    if (Array.isArray(agent.toolIds)) {
      const original = agent.toolIds.map((item) => String(item || '').trim()).filter(Boolean);
      const kept = original.filter((toolId) => existingToolIds.has(toolId));
      if (
        kept.length !== original.length &&
        !warnings.includes('已移除智能体中不存在或越界生成的工具引用。')
      ) {
        warnings.push('已移除智能体中不存在或越界生成的工具引用。');
      }
      agent.toolIds = kept;
    }
    if (Array.isArray(agent.skillIds)) {
      const original = agent.skillIds.map((item) => String(item || '').trim()).filter(Boolean);
      const kept = original.filter((skillId) => existingSkillIds.has(skillId));
      if (
        kept.length !== original.length &&
        !warnings.includes('已移除智能体中不存在或越界生成的技能引用。')
      ) {
        warnings.push('已移除智能体中不存在或越界生成的技能引用。');
      }
      agent.skillIds = kept;
    }
  }

  private sanitizeWorkflowPlanForResourcePolicy(
    workflowPlan: unknown,
    request: AiBuildRequest,
    catalog: AiBuildCatalog,
    warnings: string[]
  ): unknown {
    if (
      !isPlainObject(workflowPlan) ||
      request.target !== 'workflow' ||
      request.allowResourceCreation === true
    ) {
      return workflowPlan;
    }
    const next = deepClone(workflowPlan) as any;
    if (!Array.isArray(next.steps)) return next;

    const PIPELINE_KINDS = new Set<string>([
      'adapter',
      'store-query',
      'store-write',
      'kv-write',
      'transform',
      'batch-iterate'
    ]);
    const fallbackAgentId = catalog.agents[0]?.id;
    const fallbackWorkflowId = catalog.workflows[0]?.id;
    const existingAgentIds = new Set(catalog.agents.map((agent) => agent.id));
    const existingWorkflowIds = new Set(catalog.workflows.map((workflow) => workflow.id));
    const existingToolIds = new Set(catalog.tools.map((tool) => tool.id));
    let changed = false;

    next.steps = next.steps.map((step: any) => {
      if (!isPlainObject(step)) return step;
      const sanitized = { ...step };
      if (sanitized.needsNewAgent || sanitized.needsNewSkill) {
        delete sanitized.needsNewAgent;
        delete sanitized.needsNewSkill;
        changed = true;
      }

      // Pipeline 步骤无需 resourceRef，跳过引用整理。
      const stepKind = String(sanitized.kind || '');
      if (PIPELINE_KINDS.has(stepKind)) {
        if (sanitized.resourceRef) {
          delete sanitized.resourceRef;
          changed = true;
        }
        return sanitized;
      }

      const ref = String(sanitized.resourceRef || '').trim();
      const refId = ref.includes(':') ? ref.split(':').slice(1).join(':') : ref;
      if (sanitized.kind === 'agent' && (!ref || !existingAgentIds.has(refId))) {
        if (fallbackAgentId) {
          sanitized.resourceRef = `agent:${fallbackAgentId}`;
          changed = true;
        }
      }
      if (sanitized.kind === 'workflow' && (!ref || !existingWorkflowIds.has(refId))) {
        if (fallbackWorkflowId) {
          sanitized.resourceRef = `workflow:${fallbackWorkflowId}`;
          changed = true;
        }
      }
      if (sanitized.kind === 'tool' && ref && !existingToolIds.has(refId)) {
        delete sanitized.resourceRef;
        changed = true;
      }
      return sanitized;
    });

    if (changed && !warnings.includes('已按仅复用现有资源策略整理工作流步骤引用。')) {
      warnings.push('已按仅复用现有资源策略整理工作流步骤引用。');
    }
    return next;
  }

  private fillDefaults(plan: AiBuildPlan, request: AiBuildRequest, catalog: AiBuildCatalog) {
    const existingAgentIds = new Set(catalog.agents.map((agent) => agent.id));
    const createdAgentIds = new Set<string>();
    for (const change of plan.resourceChanges) {
      if (change.action !== 'createAgent' && change.action !== 'updateAgent') continue;
      const agent = change.agent as any;
      const baseId = agent.id || slugifyId(agent.name || request.goal, 'agent');
      agent.id =
        change.action === 'createAgent'
          ? ensureUniqueId(baseId, new Set([...existingAgentIds, ...createdAgentIds]))
          : baseId;
      createdAgentIds.add(agent.id);
      agent.name = agent.name || request.goal.slice(0, 40) || agent.id;
      agent.description = agent.description || request.goal;
      agent.systemPrompt =
        agent.systemPrompt || `你是${agent.name}。请根据输入完成目标：${request.goal}`;
      agent.providerId = agent.providerId || catalog.defaults.providerId;
      agent.model = agent.model || catalog.defaults.model;
      agent.temperature = typeof agent.temperature === 'number' ? agent.temperature : 0.3;
      agent.toolIds = Array.isArray(agent.toolIds) ? agent.toolIds : [];
      agent.skillIds = Array.isArray(agent.skillIds) ? agent.skillIds : [];
      agent.mcpServerIds = Array.isArray(agent.mcpServerIds) ? agent.mcpServerIds : [];
      agent.metadata = {
        ...(agent.metadata || {}),
        aiBuilder: {
          ...((agent.metadata || {}).aiBuilder || {}),
          generatedBy:
            (agent.metadata || {}).aiBuilder?.generatedBy ||
            (plan.target === 'workflow' ? 'workflow-builder' : 'agent-builder'),
          contract: {
            ...((agent.metadata || {}).aiBuilder?.contract || {}),
            inputSchema:
              (agent.metadata || {}).aiBuilder?.contract?.inputSchema || request.inputSchema,
            outputSchema:
              (agent.metadata || {}).aiBuilder?.contract?.outputSchema || request.outputSchema
          }
        }
      };
    }

    const existingSkillIds = new Set(catalog.skills.map((skill) => skill.id));
    const createdSkillIds = new Set<string>();
    for (const change of plan.resourceChanges) {
      if (change.action !== 'createSkillFile' && change.action !== 'updateSkillFile') continue;
      const baseId = change.skillId || slugifyId(request.goal, 'skill');
      if (change.action === 'createSkillFile') {
        change.skillId = ensureUniqueId(baseId, new Set([...existingSkillIds, ...createdSkillIds]));
        createdSkillIds.add(change.skillId);
      } else if (request.target === 'skill' && request.mode === 'update' && request.resourceId) {
        change.skillId = request.resourceId;
      } else {
        change.skillId = baseId;
      }
      if (!change.filePath) change.filePath = 'SKILL.md';
      if (!change.content && change.filePath === 'SKILL.md') {
        change.content = `---\nname: ${change.skillId}\ndescription: ${request.goal}\n---\n\n# ${change.skillId}\n\n${request.goal}\n`;
      }
    }
  }

  private compileWorkflowPlanIfNeeded(
    plan: AiBuildPlan,
    request: AiBuildRequest,
    catalog: AiBuildCatalog
  ) {
    if (
      !plan.workflowPlan ||
      plan.resourceChanges.some(
        (change) => change.action === 'createWorkflow' || change.action === 'updateWorkflow'
      )
    ) {
      return;
    }
    const createdAgents = plan.resourceChanges
      .filter((change) => change.action === 'createAgent' || change.action === 'updateAgent')
      .map((change) => (change as any).agent as AgentDefinition);
    const workflow = this.compiler.compile(plan.workflowPlan, {
      catalog,
      createdAgents,
      workflowId: request.mode === 'update' ? request.resourceId : plan.workflowPlan.id,
      mode: request.mode
    });
    plan.resourceChanges.push({
      action: request.mode === 'update' ? 'updateWorkflow' : 'createWorkflow',
      workflow
    });
  }

  buildFallbackPlan(request: AiBuildRequest, catalog: AiBuildCatalog, reason: string): AiBuildPlan {
    const targetName = request.goal.slice(0, 32) || request.target;
    const warnings = [`AI 计划生成失败，已生成最小可编辑草稿：${reason}`];

    if (request.target === 'agent') {
      const agentId =
        request.mode === 'update' && request.resourceId
          ? request.resourceId
          : slugifyId(targetName, 'agent');
      return {
        id: `build_${Date.now().toString(36)}`,
        target: request.target,
        mode: request.mode,
        summary: `创建/修改智能体：${targetName}`,
        questions: [],
        warnings,
        resourceChanges: [
          {
            action: request.mode === 'update' ? 'updateAgent' : 'createAgent',
            agent: {
              id: agentId,
              name: targetName,
              description: request.goal,
              systemPrompt: `你是${targetName}。请完成以下目标：${request.goal}`,
              providerId: catalog.defaults.providerId,
              model: catalog.defaults.model,
              temperature: 0.3,
              toolIds: [],
              skillIds: [],
              mcpServerIds: [],
              metadata: {
                aiBuilder: {
                  generatedBy: 'agent-builder',
                  contract: { inputSchema: request.inputSchema, outputSchema: request.outputSchema }
                }
              }
            }
          }
        ],
        validation: { status: 'invalid', errors: [] }
      };
    }

    if (request.target === 'skill') {
      const skillId =
        request.mode === 'update' && request.resourceId
          ? request.resourceId
          : slugifyId(targetName, 'skill');
      return {
        id: `build_${Date.now().toString(36)}`,
        target: request.target,
        mode: request.mode,
        summary: `创建/修改技能：${targetName}`,
        questions: [],
        warnings,
        resourceChanges: [
          {
            action: request.mode === 'update' ? 'updateSkillFile' : 'createSkillFile',
            skillId,
            filePath: 'SKILL.md',
            content: `---\nname: ${targetName}\ndescription: ${request.goal}\n---\n\n# ${targetName}\n\n${request.goal}\n`
          }
        ],
        validation: { status: 'invalid', errors: [] }
      };
    }

    const agentId = slugifyId(`${targetName}_agent`, 'agent');
    const workflowPlan: WorkflowPlan = {
      name: targetName,
      description: request.goal,
      inputSchema: request.inputSchema,
      outputSchema: request.outputSchema,
      steps: [
        {
          id: 'step_1',
          goal: request.goal,
          kind: 'agent',
          consumes: ['input'],
          produces: ['result'],
          resourceRef: `agent:${agentId}`,
          needsNewAgent: true
        }
      ]
    };
    const agent: AgentDefinition = {
      id: agentId,
      name: `${targetName}智能体`,
      description: request.goal,
      systemPrompt: `你是${targetName}智能体。请根据工作流输入完成目标：${request.goal}`,
      providerId: catalog.defaults.providerId,
      model: catalog.defaults.model,
      temperature: 0.3,
      toolIds: [],
      skillIds: [],
      mcpServerIds: [],
      metadata: {
        aiBuilder: {
          generatedBy: 'workflow-builder',
          contract: { inputSchema: request.inputSchema, outputSchema: request.outputSchema }
        }
      }
    };
    const workflow = this.compiler.compile(workflowPlan, { catalog, createdAgents: [agent] });
    return {
      id: `build_${Date.now().toString(36)}`,
      target: request.target,
      mode: request.mode,
      summary: `创建/修改工作流：${targetName}`,
      questions: [],
      warnings,
      workflowPlan,
      resourceChanges: [
        { action: 'createAgent', agent },
        { action: request.mode === 'update' ? 'updateWorkflow' : 'createWorkflow', workflow }
      ],
      validation: { status: 'invalid', errors: [] }
    };
  }

  private defaultSummary(request: AiBuildRequest) {
    return `${request.mode === 'create' ? '创建' : '修改'}${request.target}: ${request.goal}`;
  }

  inferResourceCreationPolicy(
    target: AiBuildTarget,
    mode: AiBuildMode,
    mentions: AiBuilderMention[],
    userGoal: string,
    explicit?: AiBuildRequest,
    planAnswers?: Record<string, unknown>
  ): {
    reusePolicy: AiBuildRequest['reusePolicy'];
    allowResourceCreation: boolean;
    reason: string;
  } {
    if (target !== 'workflow') {
      return {
        reusePolicy: 'existingOnly',
        allowResourceCreation: false,
        reason: `${targetLabelForSeed(target)}构建器只能修改自身资源`
      };
    }

    if (explicit?.allowResourceCreation === true || explicit?.reusePolicy === 'allowCreate') {
      return {
        reusePolicy: explicit.reusePolicy || 'allowCreate',
        allowResourceCreation: true,
        reason:
          explicit.resourceCreationReason ||
          (explicit.reusePolicy === 'allowCreate'
            ? '请求体允许创建缺失能力'
            : '请求体显式允许创建缺失能力')
      };
    }

    if (yesLike(planAnswers?.workflow_create_resources)) {
      return {
        reusePolicy: 'allowCreate',
        allowResourceCreation: true,
        reason: '用户在计划问题中确认允许新建缺失的子智能体或技能'
      };
    }

    const reusePolicyFromAnswers = reusePolicyFromPlanAnswers(planAnswers);
    if (reusePolicyFromAnswers === 'allowCreate') {
      return {
        reusePolicy: 'allowCreate',
        allowResourceCreation: true,
        reason: '用户在计划问题中选择允许创建缺失资源'
      };
    }
    if (reusePolicyFromAnswers === 'existingOnly') {
      return {
        reusePolicy: 'existingOnly',
        allowResourceCreation: false,
        reason: '用户在计划问题中选择只复用现有资源'
      };
    }
    if (reusePolicyFromAnswers === 'preferExisting') {
      return {
        reusePolicy: 'preferExisting',
        allowResourceCreation: false,
        reason: '用户在计划问题中选择优先复用现有资源'
      };
    }

    if (
      explicit?.allowResourceCreation === false ||
      explicit?.reusePolicy === 'existingOnly' ||
      textForbidsNewCapabilities(userGoal)
    ) {
      return {
        reusePolicy: 'existingOnly',
        allowResourceCreation: false,
        reason: '用户要求只复用现有资源，不创建新的智能体或技能'
      };
    }

    if (
      mode === 'create' &&
      (mentionsRequestNewCapabilities(mentions) || textAllowsNewCapabilities(userGoal))
    ) {
      return {
        reusePolicy: 'allowCreate',
        allowResourceCreation: true,
        reason: mentionsRequestNewCapabilities(mentions)
          ? '用户通过 @ 同时请求创建智能体或技能'
          : '用户明确允许为工作流新建缺失能力'
      };
    }

    return {
      reusePolicy: explicit?.reusePolicy || 'preferExisting',
      allowResourceCreation: false,
      reason: '默认策略：优先复用现有资源；资源不足时先追问用户确认'
    };
  }

  allowedResourceChangeActionsForRequest(request: AiBuildRequest): string[] {
    if (request.target === 'agent') {
      return [request.mode === 'update' ? 'updateAgent' : 'createAgent'];
    }
    if (request.target === 'skill') {
      return [request.mode === 'update' ? 'updateSkillFile' : 'createSkillFile'];
    }
    if (request.target === 'workflow') {
      if (request.mode === 'update') {
        return request.allowResourceCreation === true
          ? ['updateWorkflow', 'createAgent', 'updateAgent', 'createSkillFile', 'updateSkillFile']
          : ['updateWorkflow'];
      }
      return request.allowResourceCreation === true
        ? ['createWorkflow', 'createAgent', 'updateAgent', 'createSkillFile', 'updateSkillFile']
        : ['createWorkflow'];
    }
    return [];
  }
}
