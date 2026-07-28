import type { WorkflowStep } from '../../../types/agent.js';
import type { AIMessage } from '../../../types/index.js';
import type { AgentValidationKind } from './AgentOutputError.js';
import type { BatchFailureKind } from './BatchOutputError.js';
import { resolveCoverageItems } from './batchOutputValidation.js';
import { compactFailureOutput } from './batchUtils.js';

type BatchExecutionConfig = NonNullable<WorkflowStep['execution']>;

interface BatchCorrectionFeedback {
  kind: BatchFailureKind;
  error: string;
  previousOutput: string;
}

interface AgentCorrectionFeedback {
  kind: AgentValidationKind;
  error: string;
  previousOutput: string;
}

/**
 * 在 batch agent 失败时构造下一轮"自纠错"的 prompt 序列。
 * 关键约束：
 *  - 把上一轮 raw output（可能很长）做"中间省略"截断，避免给下一轮塞过多 token；
 *  - 把每条 input item 的 id/title 重新展示给 agent，强迫"全量补齐"。
 */
export function buildBatchCorrectionMessages(
  originalInput: string,
  feedback: BatchCorrectionFeedback,
  batch: Record<string, unknown>[],
  _execution: BatchExecutionConfig
): AIMessage[] {
  const requiredIds = batch.map((item, index) => ({
    position: index + 1,
    index: item.index,
    title: item.title ?? item.headline
  }));
  const expectedShape =
    'Return only one complete valid JSON object in the form {"items":[...]} or a JSON array.';
  return [
    { role: 'user', content: originalInput },
    { role: 'assistant', content: compactFailureOutput(feedback.previousOutput || '') },
    {
      role: 'user',
      content: [
        'The previous response failed deterministic workflow validation.',
        `Failure type: ${feedback.kind}`,
        `Validation error: ${feedback.error}`,
        `Expected input item count: ${batch.length}`,
        `Required item identifiers, in order: ${JSON.stringify(requiredIds)}`,
        expectedShape,
        'Do not summarize the problem. Do not omit any input item. Do not add markdown fences.',
        'Correct only the output format/content and return the full replacement JSON now.'
      ].join('\n')
    }
  ];
}

/**
 * 单 agent 步骤失败时构造的纠错 prompt 序列：
 * 与 batch 版本结构一致，但 requiredIds 来源是 validateCoverage 配置。
 */
export function buildAgentCorrectionMessages(
  originalInput: string,
  feedback: AgentCorrectionFeedback,
  step: WorkflowStep,
  stepInput: unknown
): AIMessage[] {
  const requiredIds = step.execution?.validateCoverage
    ? resolveCoverageItems(stepInput, step.execution).map((item, index) => ({
        position: index + 1,
        index: item[step.execution?.validateCoverage?.idField || 'index'],
        title: item.title ?? item.headline
      }))
    : [];
  return [
    { role: 'user', content: originalInput },
    { role: 'assistant', content: compactFailureOutput(feedback.previousOutput || '') },
    {
      role: 'user',
      content: [
        'The previous response failed deterministic workflow validation.',
        `Failure type: ${feedback.kind}`,
        `Validation error: ${feedback.error}`,
        requiredIds.length
          ? `Required item identifiers, in order: ${JSON.stringify(requiredIds)}`
          : '',
        step.execution?.validateCoverage
          ? 'Return one complete valid JSON object. Every required identifier must appear exactly once in the configured coverage fields.'
          : 'Return one complete valid JSON object.',
        'Do not summarize the problem. Do not omit any required item. Do not add markdown fences.',
        'Correct only the output format/content and return the full replacement JSON now.'
      ]
        .filter(Boolean)
        .join('\n')
    }
  ];
}
