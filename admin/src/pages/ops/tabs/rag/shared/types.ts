import type { RagEvalDataset, RagIndexVersion } from '../../../../../services/ragService';

export type RagPipelineTab = 'ingest' | 'retrieve' | 'diagnose';

export type RagObservabilityData = {
  traces: any[];
  selectedTrace?: any;
  indexVersions: RagIndexVersion[];
  activeIndexVersion?: RagIndexVersion;
  evalRuns: any[];
  evalDatasets: RagEvalDataset[];
};

export type ReindexOptions = {
  limit: number;
  targetStorage: import('./ragStatusLabels.js').ReindexTarget;
  dryRun: boolean;
  onlyMissing: boolean;
  documentIds: string;
  categoryIds: string;
  indexVersion: string;
};

export type DiagnoseAdvancedView = 'traces' | 'versions' | 'eval';
