import React from 'react';
import { RagAgentSelectors } from '../../../../settings/fields/RagAgentSelectors.js';
import {
  JOB_FIELDS,
  PLANNER_FIELDS,
  QUALITY_FIELDS,
  RETRIEVAL_SWITCHES,
  SCORE_FIELDS
} from '../shared/ragFieldMeta.js';
import { boolValue, numberValue } from '../shared/ragStatusLabels.js';
import { NumberField, SectionCard, ToggleCard } from '../shared/ragUi.js';

type Props = {
  ragConfig: Record<string, unknown>;
  agents: Array<{ id: string; name: string; model?: string; providerId?: string }>;
  synthesisStatus?: { configured?: boolean; found?: boolean };
  plannerStatus?: { configured?: boolean; found?: boolean };
  onPatch: (patch: Record<string, unknown>) => void;
};

export const RetrieveAdvancedPanel: React.FC<Props> = ({
  ragConfig,
  agents,
  synthesisStatus,
  plannerStatus,
  onPatch
}) => (
  <details className="rounded-2xl border border-hairline-soft bg-canvas dark:border-white/10 dark:bg-surface-dark">
    <summary className="cursor-pointer select-none px-4 py-3 text-base font-semibold text-text-ink dark:text-white">
      高级检索配置
    </summary>
    <div className="space-y-4 border-t border-hairline-soft px-4 py-4 dark:border-white/10">
      <SectionCard title="策略开关">
        <div className="grid gap-3 md:grid-cols-2">
          {RETRIEVAL_SWITCHES.map((meta) => (
            <ToggleCard
              key={meta.field}
              checked={boolValue(ragConfig, meta.field)}
              label={meta.label}
              hint={meta.hint}
              onChange={(checked) => onPatch({ [meta.field]: checked })}
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard title="召回参数">
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            {QUALITY_FIELDS.map((meta) => (
              <NumberField
                key={meta.field}
                meta={meta}
                value={numberValue(ragConfig, meta.field)}
                onChange={(value) => onPatch({ [meta.field]: value })}
              />
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {SCORE_FIELDS.map((meta) => (
              <NumberField
                key={meta.field}
                meta={meta}
                value={numberValue(ragConfig, meta.field)}
                onChange={(value) => onPatch({ [meta.field]: value })}
              />
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {JOB_FIELDS.map((meta) => (
              <NumberField
                key={meta.field}
                meta={meta}
                value={numberValue(ragConfig, meta.field)}
                onChange={(value) => onPatch({ [meta.field]: value })}
              />
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {PLANNER_FIELDS.map((meta) => (
              <NumberField
                key={meta.field}
                meta={meta}
                value={numberValue(ragConfig, meta.field)}
                onChange={(value) => onPatch({ [meta.field]: value })}
              />
            ))}
          </div>
        </div>
      </SectionCard>

      <SectionCard title="智能体">
        <RagAgentSelectors
          ragConfig={ragConfig}
          agents={agents}
          onPatch={onPatch}
          synthesisStatus={synthesisStatus}
          plannerStatus={plannerStatus}
        />
      </SectionCard>
    </div>
  </details>
);
