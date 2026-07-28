import type {
  BusinessPipelineInputIssue,
  DailyQualityGatePipelineInput,
  DailyQualityGatePipelineRunResult,
  InvalidBusinessPipelineInputRunResult
} from '../../types/businessPipeline.js';
import type { DailyQualityGatePolicy } from '../../types/dailyQualityGate.js';
import { DailyQualityGateService } from '../editorial/DailyQualityGateService.js';
import { explicitRunMetadata } from './businessPipelineRegistry.js';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function normalizeDailyQualityGateInput(value: unknown): DailyQualityGatePipelineInput {
  const input = asRecord(value);
  const policy = asRecord(input.policy) as Partial<DailyQualityGatePolicy>;
  return {
    report: input.report,
    policy: {
      ...policy,
      enabled: true
    }
  };
}

function validateDailyQualityGateInput(value: unknown): BusinessPipelineInputIssue[] {
  const input = asRecord(value);
  const issues: BusinessPipelineInputIssue[] = [];

  if (input.report === undefined || input.report === null) {
    issues.push({
      code: 'missing_required_field',
      path: '$.report',
      message: '日报质检入口缺少 report'
    });
    return issues;
  }

  if (!asRecord(input.report)) {
    issues.push({
      code: 'invalid_type',
      path: '$.report',
      message: '日报质检入口 report 必须是对象',
      value: input.report
    });
  }

  return issues;
}

function invalidDailyQualityGateInput(
  issues: BusinessPipelineInputIssue[]
): InvalidBusinessPipelineInputRunResult {
  return {
    status: 'invalid_input',
    pipelineId: 'dailyQualityGate',
    issues,
    persisted: false,
    ...explicitRunMetadata('dailyQualityGate')
  };
}

export function runDailyQualityGateBusinessPipeline(input: unknown): DailyQualityGatePipelineRunResult | InvalidBusinessPipelineInputRunResult {
  const issues = validateDailyQualityGateInput(input);
  if (issues.length > 0) return invalidDailyQualityGateInput(issues);

  const service = new DailyQualityGateService();
  const pipelineInput = normalizeDailyQualityGateInput(input);
  return {
    status: 'success',
    pipelineId: 'dailyQualityGate',
    result: service.evaluate(pipelineInput),
    ...explicitRunMetadata('dailyQualityGate')
  };
}