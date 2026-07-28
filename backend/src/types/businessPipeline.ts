import type { DailyQualityGateInput, DailyQualityGateResult } from './dailyQualityGate.js';
import type { EventFollowupEvaluateInput, EventFollowupEvaluation } from './eventFollowup.js';

export type BusinessPipelineId =
  | 'eventFollowup'
  | 'dailyQualityGate'
  | 'breakingFlash'
  | 'channelDerivative'
  | 'weeklyNewsletter'
  | 'factCheck';

export type BusinessPipelineStatus = 'rebuild_required' | 'explicit_entry_ready';

export type BusinessPipelineAcceptanceStatus =
  | 'not_started'
  | 'code_added_pending_validation';

export type BusinessPipelineInputIssueCode =
  | 'missing_required_field'
  | 'invalid_type'
  | 'empty_array'
  | 'invalid_item';

export interface BusinessPipelineInputIssue {
  code: BusinessPipelineInputIssueCode;
  path: string;
  message: string;
  value?: unknown;
}

export interface BusinessPipelineInputContract {
  required: string[];
  optional?: string[];
  notes?: string;
}

export interface BusinessPipelineOutputContract {
  fields: string[];
  notes?: string;
}

export interface EventFollowupPipelineInput extends EventFollowupEvaluateInput {
  commit?: boolean;
}

export type DailyQualityGatePipelineInput = DailyQualityGateInput;

export interface BusinessPipelineRunMetadata {
  mode: 'explicit';
  defaultRouteEnabled: false;
  scheduleEnabled: false;
  acceptanceStatus: BusinessPipelineAcceptanceStatus;
}

export interface EventFollowupPipelineRunResult extends BusinessPipelineRunMetadata {
  status: 'success';
  pipelineId: 'eventFollowup';
  persisted: boolean;
  result: EventFollowupEvaluation;
}

export interface DailyQualityGatePipelineRunResult extends BusinessPipelineRunMetadata {
  status: 'success';
  pipelineId: 'dailyQualityGate';
  result: DailyQualityGateResult;
}

export interface InvalidBusinessPipelineInputRunResult extends BusinessPipelineRunMetadata {
  status: 'invalid_input';
  pipelineId: Extract<BusinessPipelineId, 'eventFollowup' | 'dailyQualityGate'>;
  issues: BusinessPipelineInputIssue[];
  persisted: false;
}

export interface DisabledBusinessPipelineRunResult extends BusinessPipelineRunMetadata {
  status: 'disabled';
  pipelineId: BusinessPipelineId;
  message: string;
}

export type BusinessPipelineRunResult =
  | EventFollowupPipelineRunResult
  | DailyQualityGatePipelineRunResult
  | InvalidBusinessPipelineInputRunResult
  | DisabledBusinessPipelineRunResult;