import type {
  BusinessPipelineInputIssue,
  EventFollowupPipelineRunResult,
  InvalidBusinessPipelineInputRunResult
} from '../../types/businessPipeline.js';
import type { EventFollowupCandidate } from '../../types/eventFollowup.js';
import type { LocalStore } from '../LocalStore.js';
import { EventFollowupStateService } from '../editorial/EventFollowupStateService.js';
import { explicitRunMetadata } from './businessPipelineRegistry.js';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asCandidates(value: unknown): EventFollowupCandidate[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asRecord(item))
    .map((item) => {
      const metadata = asRecord(item.metadata);
      return {
        title: text(item.title),
        url: text(item.url) || undefined,
        source: text(item.source) || undefined,
        publishedAt: text(item.publishedAt) || undefined,
        summary: text(item.summary) || undefined,
        factFingerprint: text(item.factFingerprint) || undefined,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined
      };
    })
    .filter((item) => item.title);
}

function normalizeEventFollowupInput(value: unknown) {
  const input = asRecord(value);
  return {
    date: text(input.date),
    topicKey: text(input.topicKey),
    candidates: asCandidates(input.candidates),
    summary: text(input.summary) || undefined,
    commit: input.commit === false ? false : true
  };
}

function validateEventFollowupInput(value: unknown): BusinessPipelineInputIssue[] {
  const input = asRecord(value);
  const issues: BusinessPipelineInputIssue[] = [];

  if (!text(input.date)) {
    issues.push({
      code: 'missing_required_field',
      path: '$.date',
      message: '事件续报入口缺少 date'
    });
  }

  if (!text(input.topicKey)) {
    issues.push({
      code: 'missing_required_field',
      path: '$.topicKey',
      message: '事件续报入口缺少 topicKey'
    });
  }

  if (!Array.isArray(input.candidates)) {
    issues.push({
      code: 'invalid_type',
      path: '$.candidates',
      message: '事件续报入口 candidates 必须是数组',
      value: input.candidates
    });
    return issues;
  }

  if (input.candidates.length === 0) {
    issues.push({
      code: 'empty_array',
      path: '$.candidates',
      message: '事件续报入口 candidates 不能为空'
    });
    return issues;
  }

  input.candidates.forEach((candidate, index) => {
    const item = asRecord(candidate);
    if (!text(item.title)) {
      issues.push({
        code: 'invalid_item',
        path: `$.candidates[${index}].title`,
        message: '事件续报候选素材缺少有效 title',
        value: item.title
      });
    }
  });

  return issues;
}

function invalidEventFollowupInput(
  issues: BusinessPipelineInputIssue[]
): InvalidBusinessPipelineInputRunResult {
  return {
    status: 'invalid_input',
    pipelineId: 'eventFollowup',
    issues,
    persisted: false,
    ...explicitRunMetadata('eventFollowup')
  };
}

export async function runEventFollowupBusinessPipeline(
  store: LocalStore,
  input: unknown
): Promise<EventFollowupPipelineRunResult | InvalidBusinessPipelineInputRunResult> {
  const issues = validateEventFollowupInput(input);
  if (issues.length > 0) return invalidEventFollowupInput(issues);

  const service = new EventFollowupStateService(store);
  const pipelineInput = normalizeEventFollowupInput(input);
  const result = pipelineInput.commit === false
    ? await service.evaluate(pipelineInput)
    : await service.evaluateAndCommit(pipelineInput);

  return {
    status: 'success',
    pipelineId: 'eventFollowup',
    persisted: pipelineInput.commit !== false,
    result,
    ...explicitRunMetadata('eventFollowup')
  };
}