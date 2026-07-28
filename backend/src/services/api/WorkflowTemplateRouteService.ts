import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import type { SystemSettings } from '../../types/config.js';
import type { LocalStore } from '../LocalStore.js';
import { LogService } from '../LogService.js';
import { PromptService } from '../PromptService.js';
import { computeTemplateHash, withTemplateMetadata } from '../seeders/templateMetadata.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../../..');

export type TemplateConflictStrategy = 'reuse' | 'copy' | 'fail';

export interface WorkflowTemplateInstantiateOptions {
  variables?: Record<string, unknown>;
  conflictStrategy?: TemplateConflictStrategy;
}

export interface WorkflowTemplateInstantiateResult {
  status: 'success';
  templateId: string;
  templateHash: string;
  createdAgents: string[];
  reusedAgents: string[];
  createdWorkflows: string[];
  reusedWorkflows: string[];
}

/**
 * 工作流模板的读取与实例化能力。承担「workflow-template」路由的核心业务。
 *
 * 命名 `WorkflowTemplateRouteService` 与其他 `*RouteService` 保持一致。
 */
export class WorkflowTemplateRouteService {
  constructor(
    private readonly store: LocalStore,
    private readonly settings?: SystemSettings
  ) {}

  getTemplateDir() {
    return path.join(
      projectRoot,
      'backend',
      process.env.NODE_ENV === 'production' ? 'dist/templates' : 'templates'
    );
  }

  async listTemplates() {
    let files: string[] = [];
    try {
      files = await fs.readdir(this.getTemplateDir());
    } catch {
      return [];
    }
    const templates = await Promise.all(
      files
        .filter((file) => file.endsWith('.json'))
        .map(async (file) => {
          const tpl = await this.readTemplateById(path.basename(file, '.json'));
          return {
            id: tpl.id,
            name: tpl.name,
            description: tpl.description,
            category: tpl.category,
            requiredTools: tpl.requiredTools || [],
            requiredSkills: tpl.requiredSkills || [],
            variables: tpl.variables || [],
            agentCount: Array.isArray(tpl.agents) ? tpl.agents.length : 0,
            workflowCount: Array.isArray(tpl.workflows) ? tpl.workflows.length : 0
          };
        })
    );
    return templates;
  }

  async readTemplateById(id: string) {
    const safeId = this.safeTemplateId(id);
    return this.readJsonFile(path.join(this.getTemplateDir(), `${safeId}.json`));
  }

  async instantiate(
    templateId: string,
    options: WorkflowTemplateInstantiateOptions = {}
  ): Promise<WorkflowTemplateInstantiateResult> {
    const template = await this.readTemplateById(templateId);
    const defaults = Object.fromEntries(
      (template.variables || []).map((v: any) => [v.id, v.defaultValue ?? ''])
    );
    const providerDefaults = this.resolveProviderDefaults(options.variables);
    const variables = {
      ...defaults,
      ...providerDefaults,
      ...(options.variables || {})
    };
    const conflictStrategy = options.conflictStrategy || 'copy';
    const expanded = this.resolvePromptRefs(this.applyVariables(template, variables));

    const createdAgents: string[] = [];
    const reusedAgents: string[] = [];
    const agentIdMap = new Map<string, string>();

    for (const agent of expanded.agents || []) {
      const finalId = await this.uniquifyId(
        agent.id,
        (aid) => this.store.getAgent(aid),
        conflictStrategy
      );
      const existing = await this.store.getAgent(finalId);
      agentIdMap.set(agent.id, finalId);
      if (existing && conflictStrategy === 'reuse') {
        reusedAgents.push(finalId);
        continue;
      }
      const payload = withTemplateMetadata(
        { ...agent, id: finalId },
        `workflow-template:${template.id}:agent:${agent.id}`,
        template.version || 1
      );
      await this.store.saveAgent(payload);
      createdAgents.push(finalId);
    }

    const createdWorkflows: string[] = [];
    const reusedWorkflows: string[] = [];
    const workflowIdMap = new Map<string, string>();

    for (const workflow of expanded.workflows || []) {
      const finalId = await this.uniquifyId(
        workflow.id,
        (wid) => this.store.getWorkflow(wid),
        conflictStrategy
      );
      workflowIdMap.set(workflow.id, finalId);
      if (conflictStrategy === 'reuse' && (await this.store.getWorkflow(finalId))) {
        reusedWorkflows.push(finalId);
      }
    }

    for (const workflow of expanded.workflows || []) {
      const finalId = workflowIdMap.get(workflow.id)!;
      if (reusedWorkflows.includes(finalId)) continue;

      const wf = {
        ...workflow,
        id: finalId,
        steps: this.remapWorkflowSteps(workflow.steps, agentIdMap, workflowIdMap)
      };
      const payload = withTemplateMetadata(
        wf,
        `workflow-template:${template.id}:workflow:${workflow.id}`,
        template.version || 1
      );
      await this.store.saveWorkflow(payload);
      createdWorkflows.push(finalId);
    }

    return {
      status: 'success',
      templateId: template.id,
      templateHash: computeTemplateHash(expanded),
      createdAgents,
      reusedAgents,
      createdWorkflows,
      reusedWorkflows
    };
  }

  async repairMissingTemplateAgents(): Promise<string[]> {
    const repaired: string[] = [];
    const workflows = await this.store.listWorkflows();

    for (const workflow of workflows) {
      const templateId = String(workflow.metadata?.templateId || '');
      if (!templateId || !Array.isArray(workflow.steps)) continue;

      let template: any;
      try {
        template = await this.readTemplateById(templateId);
      } catch (err) {
        LogService.warn(
          `Workflow template repair skipped for ${workflow.id}: template ${templateId} not found (${err})`
        );
        continue;
      }

      const defaults = Object.fromEntries(
        (template.variables || []).map((v: any) => [v.id, v.defaultValue ?? ''])
      );
      const variables = {
        ...defaults,
        ...this.resolveProviderDefaults(),
        ...(workflow.templateVariables && typeof workflow.templateVariables === 'object'
          ? workflow.templateVariables
          : {})
      };
      const expanded = this.resolvePromptRefs(this.applyVariables(template, variables));
      const templateWorkflow = (expanded.workflows || [])[0];
      const templateSteps = Array.isArray(templateWorkflow?.steps) ? templateWorkflow.steps : [];
      const agentDefinitionsByStepId = new Map<string, any>();

      for (const templateStep of templateSteps) {
        if (!templateStep.agentId) continue;
        const agentDefinition = (expanded.agents || []).find(
          (agent: any) => agent.id === templateStep.agentId
        );
        if (agentDefinition) agentDefinitionsByStepId.set(templateStep.id, agentDefinition);
      }

      for (const step of workflow.steps) {
        if (!step.agentId || (await this.store.getAgent(step.agentId))) continue;
        const agentDefinition = agentDefinitionsByStepId.get(step.id);
        if (!agentDefinition) continue;

        const payload = withTemplateMetadata(
          { ...agentDefinition, id: step.agentId },
          `workflow-template:${template.id}:agent:${agentDefinition.id}`,
          template.version || 1
        );
        await this.store.saveAgent(payload);
        repaired.push(step.agentId);
        LogService.info(
          `Workflow template repair created missing agent ${step.agentId} for workflow ${workflow.id} step ${step.id}`
        );
      }
    }

    return repaired;
  }

  private remapWorkflowSteps(
    steps: any[] | undefined,
    agentIdMap: Map<string, string>,
    workflowIdMap: Map<string, string>
  ): any[] {
    return (steps || []).map((step) => {
      const next = { ...step };
      if (next.agentId && agentIdMap.has(next.agentId)) {
        next.agentId = agentIdMap.get(next.agentId);
      }
      if (next.workflowId && workflowIdMap.has(next.workflowId)) {
        next.workflowId = workflowIdMap.get(next.workflowId);
      }
      if (next.config?.child && typeof next.config.child === 'object') {
        const child = { ...next.config.child };
        if (child.type === 'agent' && child.id && agentIdMap.has(child.id)) {
          child.id = agentIdMap.get(child.id);
        }
        if (child.type === 'workflow' && child.id && workflowIdMap.has(child.id)) {
          child.id = workflowIdMap.get(child.id);
        }
        next.config = { ...next.config, child };
      }
      return next;
    });
  }

  private async readJsonFile(filePath: string) {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  }

  private safeTemplateId(id: string) {
    return id.replace(/[^a-zA-Z0-9_-]/g, '');
  }

  private resolvePromptRefs(value: any): any {
    if (Array.isArray(value)) return value.map((item) => this.resolvePromptRefs(item));
    if (value && typeof value === 'object') {
      // structuredPromptRef: 'topic_copilot' -> 解析为 StructuredPrompt 对象
      if (typeof value.structuredPromptRef === 'string' && !value.systemPrompt) {
        const structured = PromptService.getInstance()
          .getRegistry()
          .getStructuredPrompt(value.structuredPromptRef);
        if (structured) {
          return {
            ...Object.fromEntries(
              Object.entries(value).filter(([key]) => key !== 'structuredPromptRef')
            ),
            systemPrompt: structured
          };
        }
        LogService.warn(`structuredPromptRef not found: ${value.structuredPromptRef}`);
      }
      // promptRef: 'translation' -> 解析为模板字符串(向后兼容)
      if (typeof value.promptRef === 'string' && !value.systemPrompt) {
        return {
          ...Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'promptRef')),
          systemPrompt: PromptService.getInstance().getPrompt(value.promptRef)
        };
      }
      return Object.fromEntries(
        Object.entries(value).map(([key, val]) => [key, this.resolvePromptRefs(val)])
      );
    }
    return value;
  }

  private applyVariables(value: any, variables: Record<string, unknown>): any {
    if (typeof value === 'string') {
      const fullPlaceholder = value.trim().match(/^\{\{\s*([\w.-]+)\s*\}\}$/);
      if (fullPlaceholder) {
        const resolved = variables[fullPlaceholder[1]];
        return resolved === null || resolved === undefined ? '' : resolved;
      }
      return value.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_match, key) =>
        String(variables[key] ?? '')
      );
    }
    if (Array.isArray(value)) return value.map((item) => this.applyVariables(item, variables));
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, val]) => [key, this.applyVariables(val, variables)])
      );
    }
    return value;
  }

  private resolveProviderDefaults(variables?: Record<string, unknown>) {
    const providerId = String(variables?.providerId || this.settings?.ACTIVE_AI_PROVIDER_ID || '');
    const provider = (this.settings?.AI_PROVIDERS || []).find((p: any) => p.id === providerId);
    return {
      providerId,
      model: provider?.models?.[0] || ''
    };
  }

  private async uniquifyId(
    baseId: string,
    exists: (id: string) => Promise<unknown>,
    mode: TemplateConflictStrategy
  ) {
    if (!(await exists(baseId))) return baseId;
    if (mode === 'reuse') return baseId;
    if (mode === 'fail') throw new Error(`ID already exists: ${baseId}`);
    let i = 2;
    while (await exists(`${baseId}_${i}`)) i++;
    return `${baseId}_${i}`;
  }
}
