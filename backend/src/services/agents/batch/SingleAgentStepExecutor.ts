import type { WorkflowStep } from '../../../types/agent.js';
import type { AIMessage } from '../../../types/index.js';
import { LogService } from '../../LogService.js';
import type { ToolExecutionContext } from '../../ToolExecutionContext.js';
import type { AgentService } from '../AgentService.js';
import {
  getAgentFailureKind,
  getAgentFailureOutput,
  getAgentMaxRetries
} from './batchExecutionPolicy.js';
import { validateSingleAgentOutput } from './batchOutputValidation.js';
import { compactFailureOutput, formatBatchError } from './batchUtils.js';
import { buildAgentCorrectionMessages } from './correctionMessages.js';

/**
 * "单 agent + validateJsonObject/validateCoverage" 步骤的执行器。
 * 与 BatchAgentStepExecutor 平级，不参与分批，但同样负责"输出校验 → 自纠错"循环。
 */
export class SingleAgentStepExecutor {
  constructor(private readonly agentService: AgentService) {}

  async run(
    step: WorkflowStep,
    inputText: string,
    stepInput: unknown,
    date: string | undefined,
    agentOpts: {
      silent: boolean;
      noTools?: boolean;
      noSkills?: boolean;
      runSource?: 'workflow';
      metadata?: Record<string, unknown>;
      toolContextExtras?: Partial<ToolExecutionContext>;
    }
  ): Promise<string> {
    const maxRetries = getAgentMaxRetries(step.execution);
    let attempt = 0;
    let lastError: unknown;
    let previousOutput = '';
    let messages: AIMessage[] | undefined;

    while (attempt <= maxRetries) {
      const agentResult = await this.agentService.runAgent(step.agentId!, inputText, date, {
        ...agentOpts,
        runSource: agentOpts.runSource ?? 'workflow',
        metadata: {
          ...(agentOpts.metadata ?? {}),
          stepId: step.id,
          agentId: step.agentId
        },
        ...(agentOpts.toolContextExtras ? { toolContextExtras: agentOpts.toolContextExtras } : {}),
        messages
      });
      const content = agentResult.content || '';
      try {
        validateSingleAgentOutput(step, content, stepInput);
        return content;
      } catch (err) {
        lastError = err;
        previousOutput = compactFailureOutput(getAgentFailureOutput(err) || content);
        if (attempt >= maxRetries) break;
        LogService.warn(
          `[Workflow ${step.id}] Agent output validation failed; asking agent to self-correct attempt ${attempt + 1}/${maxRetries}: ${formatBatchError(err)}`
        );
        messages = buildAgentCorrectionMessages(
          inputText,
          {
            kind: getAgentFailureKind(err),
            error: formatBatchError(err),
            previousOutput
          },
          step,
          stepInput
        );
        attempt += 1;
      }
    }

    throw new Error(
      `Workflow step ${step.id} failed agent output validation after ${maxRetries + 1} attempt(s): ${formatBatchError(lastError)}`
    );
  }
}
