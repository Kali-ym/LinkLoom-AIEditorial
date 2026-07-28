import React, { useState } from 'react';
import type { RagSearchExplicitResult, RagIndexVersion } from '../../../../../services/ragService';
import { DiagnoseAdvancedPanel } from './DiagnoseAdvancedPanel.js';
import { DiagnoseResultPanel } from './DiagnoseResultPanel.js';
import { DiagnoseSandbox } from './DiagnoseSandbox.js';
import type { DiagnoseAdvancedView, RagObservabilityData } from '../shared/types.js';

type Props = {
  sandboxQuery: string;
  observabilityData: RagObservabilityData;
  observabilityLoading: boolean;
  observabilityBusy: string | null;
  advancedView?: DiagnoseAdvancedView;
  advancedOpen?: boolean;
  onSandboxQueryChange: (query: string) => void;
  onSelectTrace: (traceId: string) => void;
  onRefreshObservability: () => void;
  onCreateCandidate?: () => void | Promise<void>;
  onEvaluateVersion?: (version: RagIndexVersion, datasetId: string) => void | Promise<void>;
  onActivateVersion?: (version: RagIndexVersion, force?: boolean) => void | Promise<void>;
  onRollbackVersion?: () => void | Promise<void>;
};

export const DiagnoseTab: React.FC<Props> = ({
  sandboxQuery,
  observabilityData,
  observabilityLoading,
  observabilityBusy,
  advancedView,
  advancedOpen,
  onSandboxQueryChange,
  onSelectTrace,
  onRefreshObservability,
  onCreateCandidate,
  onEvaluateVersion,
  onActivateVersion,
  onRollbackVersion
}) => {
  const [searchResult, setSearchResult] = useState<RagSearchExplicitResult | null>(null);

  return (
    <div className="space-y-4">
      <DiagnoseSandbox
        initialQuery={sandboxQuery}
        onQueryChange={onSandboxQueryChange}
        onSearchComplete={(result) => setSearchResult(result)}
      />
      {searchResult && (
        <DiagnoseResultPanel
          result={searchResult}
          selectedTrace={observabilityData.selectedTrace}
          onSelectTrace={onSelectTrace}
          onPrefillSearch={onSandboxQueryChange}
        />
      )}
      <DiagnoseAdvancedPanel
        data={observabilityData}
        loading={observabilityLoading}
        busyAction={observabilityBusy}
        initialView={advancedView}
        forceOpen={advancedOpen}
        onSelectTrace={onSelectTrace}
        onRefresh={onRefreshObservability}
        onPrefillSearch={onSandboxQueryChange}
        onCreateCandidate={onCreateCandidate}
        onEvaluateVersion={onEvaluateVersion}
        onActivateVersion={onActivateVersion}
        onRollbackVersion={onRollbackVersion}
      />
    </div>
  );
};
