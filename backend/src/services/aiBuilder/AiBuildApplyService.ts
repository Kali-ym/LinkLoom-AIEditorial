import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import type { AgentDefinition, WorkflowDefinition } from '../../types/agent.js';
import type { AiBuildApplyResult, AiBuildChange, AiBuildPlan } from '../../types/aiBuilder.js';
import type { LocalStore } from '../LocalStore.js';
import { markCustomized } from '../seeders/templateMetadata.js';
import type { ServiceContext } from '../ServiceContext.js';
import { safeRelativePath } from './AiBuilderUtils.js';

interface ApplyProgress {
  step: number;
  total: number;
  message: string;
}

type ApplyMarkerStatus = 'applying' | 'applied' | 'failed';

export class AiBuildApplyService {
  private static readonly inFlightPlanKeys = new Set<string>();

  constructor(
    private readonly store: LocalStore,
    private readonly context: ServiceContext
  ) {}

  async applyPlan(
    plan: AiBuildPlan,
    options?: { signal?: AbortSignal; onProgress?: (progress: ApplyProgress) => void }
  ): Promise<AiBuildApplyResult> {
    await this.acquirePlanLock(plan);
    const result: AiBuildApplyResult = {
      status: 'success',
      planId: plan.id,
      createdAgents: [],
      updatedAgents: [],
      createdWorkflows: [],
      updatedWorkflows: [],
      changedSkills: []
    };

    try {
      await this.recordApplyMarker(plan, 'applying', result);
      const total = (plan.resourceChanges || []).length + 1;
      for (const [index, change] of (plan.resourceChanges || []).entries()) {
        this.throwIfAborted(options?.signal, result);
        options?.onProgress?.({ step: index + 1, total, message: `正在应用 ${change.action}` });
        try {
          await this.applyChange(change, plan, result);
        } catch (error: any) {
          error.appliedChanges = this.appliedChangeIds(result);
          throw error;
        }
      }

      this.throwIfAborted(options?.signal, result);
      options?.onProgress?.({ step: total, total, message: '刷新运行时上下文...' });
      await this.context.reload();
      await this.recordApplyMarker(plan, 'applied', result);
      return result;
    } catch (error: any) {
      error.appliedChanges = error.appliedChanges || this.appliedChangeIds(result);
      await this.recordApplyMarker(
        plan,
        'failed',
        result,
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    } finally {
      this.releasePlanLock(plan);
    }
  }

  private async applyChange(change: AiBuildChange, plan: AiBuildPlan, result: AiBuildApplyResult) {
    if (change.action === 'createAgent' || change.action === 'updateAgent') {
      const existing =
        change.action === 'updateAgent' ? await this.store.getAgent(change.agent.id) : null;
      const agent = this.prepareAgentForWrite(
        change.agent,
        existing,
        plan,
        change.action === 'updateAgent'
      );
      await this.store.saveAgent(markCustomized(agent as any));
      if (change.action === 'createAgent') result.createdAgents.push(agent.id);
      else result.updatedAgents.push(agent.id);
      return;
    }

    if (change.action === 'createWorkflow' || change.action === 'updateWorkflow') {
      const existing =
        change.action === 'updateWorkflow'
          ? await this.store.getWorkflow(change.workflow.id)
          : null;
      const workflow = this.prepareWorkflowForWrite(
        change.workflow,
        existing,
        plan,
        change.action === 'updateWorkflow'
      );
      await this.store.saveWorkflow(markCustomized(workflow as any));
      if (change.action === 'createWorkflow') result.createdWorkflows.push(workflow.id);
      else result.updatedWorkflows.push(workflow.id);
      return;
    }

    const filePath = safeRelativePath(change.filePath);
    if (!filePath) throw new Error(`Illegal skill file path: ${change.filePath}`);
    await this.writeSkillFile(change.skillId, filePath, change.content);
    result.changedSkills.push({ skillId: change.skillId, filePath, action: change.action });
  }

  private prepareAgentForWrite(
    agent: AgentDefinition,
    existing: AgentDefinition | null,
    plan: AiBuildPlan,
    isUpdate: boolean
  ): AgentDefinition {
    const incoming = agent as any;
    const merged: any = isUpdate && existing ? { ...existing } : {};
    const scalarFields = [
      'id',
      'name',
      'description',
      'systemPrompt',
      'providerId',
      'model',
      'temperature',
      'streaming',
      'isHidden',
      'category',
      'runtime'
    ];
    for (const field of scalarFields) {
      if (Object.prototype.hasOwnProperty.call(incoming, field) && incoming[field] !== undefined)
        merged[field] = incoming[field];
    }
    for (const field of [
      'toolIds',
      'skillIds',
      'mcpServerIds',
      'knowledgeCategoryIds',
      'knowledgeSaveCategoryIds',
      'memoryCategoryIds',
      'memorySaveCategoryIds'
    ]) {
      if (!Object.prototype.hasOwnProperty.call(incoming, field)) continue;
      if (
        !isUpdate ||
        !existing ||
        (Array.isArray(incoming[field]) &&
          (incoming[field].length > 0 ||
            !Array.isArray((existing as any)[field]) ||
            (existing as any)[field].length === 0))
      ) {
        merged[field] = Array.isArray(incoming[field]) ? incoming[field] : [];
      }
    }
    merged.metadata = {
      ...(existing?.metadata || {}),
      ...(agent.metadata || {}),
      aiBuilder: {
        ...((existing?.metadata as any)?.aiBuilder || {}),
        ...((agent.metadata as any)?.aiBuilder || {}),
        generatedBy:
          (agent.metadata as any)?.aiBuilder?.generatedBy ||
          (existing?.metadata as any)?.aiBuilder?.generatedBy ||
          'agent-builder',
        planId: plan.id,
        planVersion: plan.version || 1
      }
    };
    return merged as AgentDefinition;
  }

  private prepareWorkflowForWrite(
    workflow: WorkflowDefinition,
    existing: WorkflowDefinition | null,
    plan: AiBuildPlan,
    isUpdate: boolean
  ): WorkflowDefinition {
    const incoming = workflow as any;
    const merged: any = isUpdate && existing ? { ...existing } : {};
    for (const field of [
      'id',
      'name',
      'description',
      'initialStepId',
      'inputSpec',
      'outputSpec',
      'templateVariables'
    ]) {
      if (Object.prototype.hasOwnProperty.call(incoming, field) && incoming[field] !== undefined)
        merged[field] = incoming[field];
    }
    if (Object.prototype.hasOwnProperty.call(incoming, 'steps')) {
      if (
        !isUpdate ||
        !existing ||
        (Array.isArray(incoming.steps) &&
          (incoming.steps.length > 0 ||
            !Array.isArray(existing.steps) ||
            existing.steps.length === 0))
      ) {
        merged.steps = (incoming.steps || []).map((step: any) => {
          const {
            inputMap: _inputMap,
            outputMap: _outputMap,
            toolParams: _toolParams,
            ...rest
          } = step;
          return rest;
        });
      }
    }
    merged.metadata = {
      ...(existing?.metadata || {}),
      ...(workflow.metadata || {}),
      aiBuilder: {
        ...((existing?.metadata as any)?.aiBuilder || {}),
        ...((workflow.metadata as any)?.aiBuilder || {}),
        generatedBy:
          (workflow.metadata as any)?.aiBuilder?.generatedBy ||
          (existing?.metadata as any)?.aiBuilder?.generatedBy ||
          'workflow-builder',
        planId: plan.id,
        planVersion: plan.version || 1
      }
    };
    return merged as WorkflowDefinition;
  }

  private throwIfAborted(signal: AbortSignal | undefined, result: AiBuildApplyResult) {
    if (!signal?.aborted) return;
    const error: any = new Error('构建已取消，未执行后续变更。');
    error.appliedChanges = this.appliedChangeIds(result);
    throw error;
  }

  private appliedChangeIds(result: AiBuildApplyResult) {
    return [
      ...result.createdAgents.map((id) => `createAgent:${id}`),
      ...result.updatedAgents.map((id) => `updateAgent:${id}`),
      ...result.createdWorkflows.map((id) => `createWorkflow:${id}`),
      ...result.updatedWorkflows.map((id) => `updateWorkflow:${id}`),
      ...result.changedSkills.map((item) => `${item.action}:${item.skillId}/${item.filePath}`)
    ];
  }

  private appliedPlanKey(plan: AiBuildPlan) {
    return `aiBuilder.appliedPlan.${plan.id}.v${plan.version || 1}`;
  }

  private async acquirePlanLock(plan: AiBuildPlan) {
    const key = this.appliedPlanKey(plan);
    if (AiBuildApplyService.inFlightPlanKeys.has(key)) {
      throw new Error(`计划 ${plan.id} v${plan.version || 1} 正在构建中，拒绝重复应用。`);
    }
    const existing = await this.store.get(this.appliedPlanKey(plan));
    if (AiBuildApplyService.inFlightPlanKeys.has(key)) {
      throw new Error(`计划 ${plan.id} v${plan.version || 1} 正在构建中，拒绝重复应用。`);
    }
    if (existing?.status === 'applied' || existing?.status === 'applying') {
      throw new Error(`计划 ${plan.id} v${plan.version || 1} 已构建过，拒绝重复应用。`);
    }
    AiBuildApplyService.inFlightPlanKeys.add(key);
  }

  private releasePlanLock(plan: AiBuildPlan) {
    AiBuildApplyService.inFlightPlanKeys.delete(this.appliedPlanKey(plan));
  }

  private async recordApplyMarker(
    plan: AiBuildPlan,
    status: ApplyMarkerStatus,
    result: AiBuildApplyResult,
    error?: string
  ) {
    await this.store.put(this.appliedPlanKey(plan), {
      planId: plan.id,
      planVersion: plan.version || 1,
      status,
      updatedAt: new Date().toISOString(),
      appliedAt: status === 'applied' ? new Date().toISOString() : undefined,
      failedAt: status === 'failed' ? new Date().toISOString() : undefined,
      error,
      appliedChanges: this.appliedChangeIds(result),
      result
    });
  }

  private async writeSkillFile(skillId: string, filePath: string, content: string) {
    let skill = await this.store.getSkill(skillId);
    const skillsDir = this.store.getSkillsDir();
    const skillDir = skill?.dirPath || path.join(skillsDir, skillId);
    const fullPath = path.resolve(skillDir, filePath);
    const root = path.resolve(skillDir);
    if (fullPath !== root && !fullPath.startsWith(`${root}${path.sep}`)) {
      throw new Error(`Illegal skill file path: ${filePath}`);
    }
    if (!fs.existsSync(path.dirname(fullPath))) {
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    }
    fs.writeFileSync(fullPath, content, 'utf8');

    if (!skill) {
      skill = {
        id: skillId,
        name: skillId,
        description: '',
        instructions: '',
        files: [],
        dirPath: skillDir
      };
    }

    if (filePath === 'SKILL.md') {
      this.syncSkillMarkdown(skill, content);
    } else if (!skill.files?.includes(filePath)) {
      skill.files = [...(skill.files || []), filePath].sort();
    }
    skill.dirPath = skillDir;
    await this.store.saveSkill(skill);
    await this.context.skillService.refreshSkills();
  }

  private syncSkillMarkdown(skill: any, content: string) {
    const normalized = content
      .replace(/^\uFEFF/, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');
    const match = normalized.match(/^---[ \t]*\n([\s\S]*?)\n---[ \t]*\n?([\s\S]*)$/);
    if (!match) {
      skill.instructions = normalized.trim();
      return;
    }
    const metadata = YAML.parse(match[1]) || {};
    skill.name = metadata.name || skill.name || skill.id;
    skill.description = metadata.description || skill.description || '';
    skill.instructions = match[2].trim();
    skill.files = (skill.files || []).filter((file: string) => file !== 'SKILL.md');
  }
}
