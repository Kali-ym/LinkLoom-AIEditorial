import type {
  AiBuildApplyRequest,
  AiBuildCatalog,
  AiBuildChatRequest,
  AiBuildPlan,
  AiBuildRequest,
  AiBuildStreamEvent,
  AiBuildDryRunResult
} from '../../types/aiBuilder.js';
import type { LocalStore } from '../LocalStore.js';
import type { ServiceContext } from '../ServiceContext.js';
import { AiBuildApplyService } from './AiBuildApplyService.js';
import { AiBuilderCatalogService } from './AiBuilderCatalogService.js';
import { AiBuilderChatService } from './AiBuilderChatService.js';
import type { AiBuilderDomainCatalogProvider } from './AiBuilderDomainCatalogProvider.js';
import { AiBuilderDryRunService } from './AiBuilderDryRunService.js';
import { AiBuilderPlanService } from './AiBuilderPlanService.js';

export class AiBuilderService {
  private readonly catalogService: AiBuilderCatalogService;
  private readonly applyService: AiBuildApplyService;
  private readonly planService: AiBuilderPlanService;
  private readonly dryRunService: AiBuilderDryRunService;
  private readonly chatService: AiBuilderChatService;

  constructor(
    private readonly store: LocalStore,
    private readonly context: ServiceContext,
    domainCatalogProvider?: AiBuilderDomainCatalogProvider
  ) {
    this.catalogService = new AiBuilderCatalogService(store, context, domainCatalogProvider);
    this.applyService = new AiBuildApplyService(store, context);
    this.planService = new AiBuilderPlanService(this.catalogService, context, store);
    this.dryRunService = new AiBuilderDryRunService(
      store,
      context,
      this.catalogService,
      this.planService
    );
    this.chatService = new AiBuilderChatService(
      context,
      this.catalogService,
      this.planService,
      this.dryRunService
    );
    this.planService.bindChatService(this.chatService);
  }

  buildCatalog(): Promise<AiBuildCatalog> {
    return this.catalogService.buildCatalog();
  }

  createPlan(request: AiBuildRequest): Promise<AiBuildPlan> {
    return this.planService.createPlan(request);
  }

  revisePlan(body: {
    request?: AiBuildRequest;
    plan?: AiBuildPlan;
    feedback?: string;
  }): Promise<AiBuildPlan> {
    return this.planService.revisePlan(body);
  }

  streamChat(
    body: AiBuildChatRequest,
    options?: { signal?: AbortSignal }
  ): AsyncIterable<AiBuildStreamEvent> {
    return this.chatService.streamChat(body, options);
  }

  async validatePlan(plan: AiBuildPlan) {
    const catalog = await this.catalogService.buildCatalog();
    const prepared = this.dryRunService.preparePlanForApply(plan, catalog, {
      throwOnInvalid: false
    });
    return prepared.validation;
  }

  async applyPlan(plan: AiBuildPlan) {
    const catalog = await this.catalogService.buildCatalog();
    const prepared = this.dryRunService.preparePlanForApply(plan, catalog);
    return this.applyService.applyPlan(prepared);
  }

  dryRunPlan(plan: AiBuildPlan): Promise<AiBuildDryRunResult> {
    return this.dryRunService.dryRunPlan(plan);
  }

  executeBuild(
    request: AiBuildApplyRequest,
    options?: { signal?: AbortSignal }
  ): AsyncIterable<AiBuildStreamEvent> {
    return this.dryRunService.executeBuild(request, options);
  }

  parsePlanFromTextForTest(text: string): unknown | null {
    return this.chatService.parsePlanFromTextForTest(text);
  }
}
