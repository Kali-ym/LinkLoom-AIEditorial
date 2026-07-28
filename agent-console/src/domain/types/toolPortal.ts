export interface ToolUIParams {
  index?: number;
  view?: 'rubric';
}

export interface SearchResultItem {
  title: string;
  url: string;
  snippet?: string;
  score?: number;
}

export interface SearchPortalState {
  results?: SearchResultItem[];
  loading?: boolean;
}

export interface CrawlPageResult {
  url: string;
  title?: string;
  description?: string;
  siteName?: string;
  content?: string;
  rawContent?: string;
  wordCount?: number;
  crawler?: string;
  error?: string;
}

export interface CrawlMultiPageState {
  results?: CrawlPageResult[];
  activePageContentUrl?: string;
}

export type VerifyOnFailStrategy = 'auto_repair' | 'manual';
export type VerifyVerifierType = 'agent' | 'llm';

export interface VerifyCriterionView {
  criterionId?: string;
  title: string;
  description?: string;
  instruction?: string;
  required: boolean;
  verifierType: VerifyVerifierType;
  onFail: VerifyOnFailStrategy;
  documentId?: string;
}

export interface VerifyPlanPortalState {
  rubricId?: string;
  rubricName?: string;
  maxRepairRounds?: number;
  items?: VerifyCriterionView[];
}
