import { describe, expect, it } from 'vitest';
import { canApplyBuildPlan, computeSessionStateGraph } from '../../admin/src/pages/agents/aiBuilder/builderGates';

function createPlan(overrides: Record<string, unknown> = {}) {
  return {
    id: 'plan_gate_test',
    target: 'agent',
    mode: 'create',
    summary: '创建测试智能体',
    questions: [],
    warnings: [],
    resourceChanges: [],
    validation: { status: 'ok', errors: [] },
    status: 'ready',
    contract: { status: 'locked' },
    dryRun: {
      planId: 'plan_gate_test',
      changes: [],
      warnings: [],
      errors: [],
      dryRunToken: 'token_gate_test'
    },
    ...overrides
  } as any;
}

describe('AI Builder frontend gates', () => {
  it('shows dry-run blocking errors before token state', () => {
    const result = canApplyBuildPlan({
      plan: createPlan({
        dryRun: {
          planId: 'plan_gate_test',
          changes: [],
          warnings: [],
          errors: ['agent.runtime.mode 缺失']
        }
      })
    });

    expect(result).toEqual({ ok: false, reason: '写库前校验存在 1 个阻塞错误' });
  });

  it('blocks apply when dry-run confirmation token is missing', () => {
    const result = canApplyBuildPlan({
      plan: createPlan({
        dryRun: {
          planId: 'plan_gate_test',
          changes: [],
          warnings: [],
          errors: []
        }
      })
    });

    expect(result).toEqual({
      ok: false,
      reason: '校验确认凭证缺失，请重新执行写库前校验'
    });
  });

  it('allows high-risk dry-run results to continue into explicit confirmation', () => {
    const result = canApplyBuildPlan({
      plan: createPlan({
        dryRun: {
          planId: 'plan_gate_test',
          changes: [],
          warnings: [],
          errors: [],
          dryRunToken: 'token_gate_test',
          riskPolicy: {
            hasHighRisk: true,
            highRiskChangeIds: ['agent_runtime_update'],
            requiresConfirmation: true
          }
        }
      })
    });

    expect(result).toEqual({ ok: true });
  });

  it('marks high-risk apply action as explicit second confirmation', () => {
    const graph = computeSessionStateGraph({
      plan: createPlan({
        dryRun: {
          planId: 'plan_gate_test',
          changes: [],
          warnings: [],
          errors: [],
          dryRunToken: 'token_gate_test',
          riskPolicy: {
            hasHighRisk: true,
            highRiskChangeIds: ['agent_runtime_update'],
            requiresConfirmation: true
          }
        }
      })
    });

    expect(graph.nextActions.find((action) => action.id === 'confirm_apply')).toMatchObject({
      label: '高风险二次确认并写库',
      disabled: false
    });
  });
});