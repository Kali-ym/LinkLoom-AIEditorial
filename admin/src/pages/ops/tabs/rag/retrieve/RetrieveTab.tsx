import React from 'react';
import type { SmallModelService } from '../../../../settings/fields/ai/smallModelUtils';
import { HybridOnboardChecklist } from './HybridOnboardChecklist.js';
import { RetrieveAdvancedPanel } from './RetrieveAdvancedPanel.js';
import { RetrieveModeSelector } from './RetrieveModeSelector.js';
import { RetrieveModelSummary } from './RetrieveModelSummary.js';
import { RetrieveReadinessCards } from './RetrieveReadinessCards.js';
import { SectionCard } from '../shared/ragUi.js';
import type { RagPipelineTab } from '../shared/types.js';

type Props = {
  ragConfig: Record<string, unknown>;
  status: any;
  agents: any[];
  hasActiveEmbedding: boolean;
  synthesisConfigured: boolean;
  activeEmbeddingId: string;
  activeRerankId: string;
  embeddingServices: SmallModelService[];
  rerankServices: SmallModelService[];
  testingServiceId: string | null;
  onPatch: (patch: Record<string, unknown>) => void;
  onChangeEmbedding: (id: string) => void;
  onChangeRerank: (id: string) => void;
  onTest: (id: string, label: string) => void;
  onNavigate: (tab: RagPipelineTab) => void;
};

export const RetrieveTab: React.FC<Props> = ({
  ragConfig,
  status,
  agents,
  hasActiveEmbedding,
  synthesisConfigured,
  activeEmbeddingId,
  activeRerankId,
  embeddingServices,
  rerankServices,
  testingServiceId,
  onPatch,
  onChangeEmbedding,
  onChangeRerank,
  onTest,
  onNavigate
}) => {
  const rerankEnabled = ragConfig.rerankEnabled === true;
  const synthesisAgentId = String(ragConfig.synthesisAgentId || '');

  return (
    <div className="space-y-4">
      <SectionCard>
        <RetrieveModeSelector ragConfig={ragConfig} onPatch={onPatch} />
      </SectionCard>
      <HybridOnboardChecklist
        ragConfig={ragConfig}
        status={status}
        hasActiveEmbedding={hasActiveEmbedding}
        onNavigate={onNavigate}
      />
      <RetrieveReadinessCards
        status={status}
        ragConfig={ragConfig}
        hasActiveEmbedding={hasActiveEmbedding}
        synthesisConfigured={synthesisConfigured}
        agents={agents}
        synthesisAgentId={synthesisAgentId}
        onPatch={onPatch}
        onNavigate={onNavigate}
      />
      <RetrieveModelSummary
        activeEmbeddingId={activeEmbeddingId}
        activeRerankId={activeRerankId}
        embeddingServices={embeddingServices}
        rerankServices={rerankServices}
        rerankEnabled={rerankEnabled}
        testingServiceId={testingServiceId}
        onChangeEmbedding={onChangeEmbedding}
        onChangeRerank={onChangeRerank}
        onTest={onTest}
      />
      <RetrieveAdvancedPanel
        ragConfig={ragConfig}
        agents={agents}
        synthesisStatus={status?.synthesisAgent}
        plannerStatus={status?.plannerAgent}
        onPatch={onPatch}
      />
    </div>
  );
};
