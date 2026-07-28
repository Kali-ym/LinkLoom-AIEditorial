import React from 'react';
import { useNavigate } from 'react-router-dom';
import type {
  GovernanceStatus,
  RegressionRunRecord,
  SourceQualityStatus
} from '../../../../services/agentService';
import { OpsRefreshButton } from '../../opsUiPrimitives';
import {
  buildGovernanceChip,
  buildQualityChip,
  buildRegressionChip,
  type PlatformChipState,
  type PlatformChipTone
} from './shared/platformStatusUtils';

type Props = {
  governance: GovernanceStatus | null;
  quality: SourceQualityStatus | null;
  runs: RegressionRunRecord[] | null;
  errors: { governance?: boolean; quality?: boolean; regression?: boolean };
  loading: boolean;
  onRefresh: () => void;
};

type ChipItem = PlatformChipState & { id: string };

function stripBasename(href: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  if (base && href.startsWith(base)) {
    return href.slice(base.length) || '/';
  }
  return href;
}

function chipToneClass(tone: PlatformChipTone): string {
  const base = 'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold';
  switch (tone) {
    case 'ok':
      return `${base} border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-200`;
    case 'warn':
      return `${base} border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100`;
    default:
      return `${base} border-gray-200 bg-gray-100 text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-text-secondary`;
  }
}

function PlatformChip({
  chip,
  onNavigate
}: {
  chip: ChipItem;
  onNavigate: (href: string) => void;
}) {
  const clickable = chip.tone === 'warn' && Boolean(chip.href);
  const className = `${chipToneClass(chip.tone)}${clickable ? ' cursor-pointer hover:opacity-90' : ''}`;

  if (clickable && chip.href) {
    return (
      <button type="button" className={className} onClick={() => onNavigate(chip.href!)}>
        {chip.label}
      </button>
    );
  }

  return <span className={className}>{chip.label}</span>;
}

export const PlatformStatusHeader: React.FC<Props> = ({
  governance,
  quality,
  runs,
  errors,
  loading,
  onRefresh
}) => {
  const navigate = useNavigate();

  const chips: ChipItem[] = [
    { id: 'governance', ...buildGovernanceChip(governance, errors.governance ?? false) },
    { id: 'quality', ...buildQualityChip(quality, errors.quality ?? false) },
    { id: 'regression', ...buildRegressionChip(runs, errors.regression ?? false) }
  ];

  return (
    <div className="space-y-3 rounded-2xl border border-hairline-soft bg-canvas p-4 dark:border-white/10 dark:bg-surface-dark">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-start gap-2">
          {chips.map((chip) => (
            <div key={chip.id} className="flex flex-col gap-1">
              <PlatformChip chip={chip} onNavigate={(href) => navigate(stripBasename(href))} />
              {chip.tone === 'warn' && chip.hint && (
                <p className="text-[11px] text-amber-800 dark:text-amber-200">{chip.hint}</p>
              )}
            </div>
          ))}
        </div>
        <OpsRefreshButton onClick={onRefresh} disabled={loading} />
      </div>
    </div>
  );
};
