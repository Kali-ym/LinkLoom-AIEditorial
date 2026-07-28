export type DailyQualitySeverity = 'error' | 'warning';

export type DailyQualityIssueCode =
  | 'missing_required_field'
  | 'empty_sections'
  | 'empty_section_items'
  | 'empty_item_body'
  | 'missing_item_url'
  | 'duplicate_title'
  | 'insufficient_sources'
  | 'headline_without_item';

export interface DailyQualityIssue {
  code: DailyQualityIssueCode;
  severity: DailyQualitySeverity;
  path: string;
  message: string;
  value?: unknown;
}

export interface DailyQualityGatePolicy {
  enabled: boolean;
  minSources: number;
  blockOnWarnings: boolean;
}

export interface DailyQualityGateInput {
  report: unknown;
  policy?: Partial<DailyQualityGatePolicy>;
}

export interface DailyQualityGateResult {
  enabled: boolean;
  approved: boolean;
  requiresApproval: boolean;
  issueCount: number;
  errorCount: number;
  warningCount: number;
  issues: DailyQualityIssue[];
  checkedAt: string;
}