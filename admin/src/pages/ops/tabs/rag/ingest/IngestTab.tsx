import React, { useRef } from 'react';
import type { RagIndexVersion } from '../../../../../services/ragService';
import { IngestActionCards } from './IngestActionCards.js';
import { IngestAdvancedPanel } from './IngestAdvancedPanel.js';
import { IngestJobQueue } from './IngestJobQueue.js';
import type { ReindexOptions } from '../shared/types.js';

type Props = {
  ragConfig: Record<string, unknown>;
  status: any;
  hasActiveEmbedding: boolean;
  pendingJobs: number;
  failedJobs: number;
  jobs: any[];
  jobsFilter: 'all' | 'failed';
  busy: string | null;
  reindexOptions: ReindexOptions;
  indexVersions: RagIndexVersion[];
  onReindexOptionsChange: (patch: Partial<ReindexOptions>) => void;
  onPatch: (patch: Record<string, unknown>) => void;
  onReindexMissing: () => void;
  onEnqueueReindex: () => void;
  onRunOnce: () => void;
  onLoadJobs: (filter: 'all' | 'failed') => void;
  onRetryDocument?: (documentId: string) => void;
  onRetryAllFailed?: () => void;
  onBindVersionNavigate?: (version: string) => void;
};

export const IngestTab: React.FC<Props> = ({
  ragConfig,
  status,
  hasActiveEmbedding,
  pendingJobs,
  failedJobs,
  jobs,
  jobsFilter,
  busy,
  reindexOptions,
  indexVersions,
  onReindexOptionsChange,
  onPatch,
  onReindexMissing,
  onEnqueueReindex,
  onRunOnce,
  onLoadJobs,
  onRetryDocument,
  onRetryAllFailed,
  onBindVersionNavigate
}) => {
  const queueRef = useRef<HTMLDivElement>(null);

  return (
    <div className="space-y-4">
      <IngestActionCards
        hasActiveEmbedding={hasActiveEmbedding}
        pendingJobs={pendingJobs}
        failedJobs={failedJobs}
        lastEmbeddingError={status?.lastEmbeddingError}
        coverage={status?.coverage}
        embeddingBatchSize={Number(ragConfig.embeddingBatchSize) || 16}
        busy={busy}
        onReindexMissing={onReindexMissing}
        onRunOnce={onRunOnce}
        onViewFailed={() => {
          onLoadJobs('failed');
          queueRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }}
      />
      <IngestJobQueue
        ref={queueRef}
        jobs={jobs}
        jobsFilter={jobsFilter}
        busy={busy}
        onLoadJobs={onLoadJobs}
        onRetryDocument={onRetryDocument}
        onRetryAllFailed={onRetryAllFailed}
      />
      <IngestAdvancedPanel
        ragConfig={ragConfig}
        hasActiveEmbedding={hasActiveEmbedding}
        reindexOptions={reindexOptions}
        indexVersions={indexVersions}
        busy={busy}
        onPatch={onPatch}
        onReindexOptionsChange={onReindexOptionsChange}
        onEnqueueReindex={onEnqueueReindex}
        onBindVersionNavigate={onBindVersionNavigate}
      />
    </div>
  );
};
