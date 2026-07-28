import { request } from './api';

export interface HistoryResponse {
  dates: string[];
}

export interface CommitRecord {
  id: number;
  date: string;
  platform: string;
  filePath: string;
  commitMessage: string;
  commitTime: number;
  fullContent?: string;
  viewUrl?: string;
}

export interface CommitHistoryResponse {
  commits: CommitRecord[];
  total: number;
}

export interface PublicationItem {
  id: number;
  historyId: number;
  date: string;
  topicId: string;
  title: string;
  urlNorm: string;
  section: string;
  importanceRank: number;
  metadata: Record<string, unknown>;
  createdAt: number;
}

export interface PublicationHistoryMatch {
  index: number;
  kind: 'url_exact' | 'title_similar' | 'semantic';
  prior_date: string;
  prior_headline: string;
  prior_topic_id?: string;
  history_id?: number;
  score?: number;
  suggestion: 'drop' | 'continuation' | 'new_angle';
  url?: string;
}

export interface PublicationHistoryQueryResult {
  lookbackDays: number;
  asOfDate: string;
  summary: string;
  reportedUrls: string[];
  matches: PublicationHistoryMatch[];
}

export interface CommittedDatesResponse {
  dates: string[];
}

export const getHistory = (): Promise<HistoryResponse> => request('/api/history');

export const getCommitHistory = (params?: {
  date?: string;
  platform?: string;
  limit?: number;
  offset?: number;
  search?: string;
}): Promise<CommitHistoryResponse> => {
  const queryParams = new URLSearchParams();
  if (params?.date) queryParams.append('date', params.date);
  if (params?.platform) queryParams.append('platform', params.platform);
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.offset) queryParams.append('offset', params.offset.toString());
  if (params?.search) queryParams.append('search', params.search);
  
  const queryString = queryParams.toString();
  return request(`/api/history/commits${queryString ? `?${queryString}` : ''}`);
};

export const getCommittedDates = (): Promise<CommittedDatesResponse> => request('/api/history/dates');

export const deleteCommitHistory = (id: number): Promise<{ status: string }> => 
  request(`/api/history/commits/${id}`, { method: 'DELETE' });

export const republishCommitHistory = (id: number): Promise<{ status: string, data?: any }> => 
  request(`/api/history/republish/${id}`, { method: 'POST' });

export const getPublicationItems = (historyId: number): Promise<{ items: PublicationItem[] }> =>
  request(`/api/history/${historyId}/items`);

export const queryPublicationHistory = (body: {
  asOfDate: string;
  lookbackDays?: number;
  items: Array<{ index: number; title?: string; url?: string }>;
}): Promise<PublicationHistoryQueryResult> =>
  request('/api/history/publication-items/query', {
    method: 'POST',
    body: JSON.stringify(body)
  });

export const backfillPublicationItems = (body: {
  limit?: number;
  dryRun?: boolean;
}): Promise<{
  processed: number;
  skipped: number;
  dates: string[];
  errors: string[];
  dryRun: boolean;
  itemCount: number;
}> =>
  request('/api/history/publication-items/backfill', {
    method: 'POST',
    body: JSON.stringify(body)
  });
