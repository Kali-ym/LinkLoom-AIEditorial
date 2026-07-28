import React, { useState, useEffect, useCallback } from 'react';
import { agentService } from '../../../../../services/agentService';
import type { SourceQualityStatus } from '../../../../../services/agentService';
import { getOpsErrorMessage, OpsErrorBanner } from '../../../opsUiPrimitives';
import { QualitySummary } from './QualitySummary';
import { QualityRulesPanel } from './QualityRulesPanel';

function splitLines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export const QualityTab: React.FC = () => {
  const [status, setStatus] = useState<SourceQualityStatus | null>(null);
  const [blacklist, setBlacklist] = useState('');
  const [whitelist, setWhitelist] = useState('');
  const [minAiScore, setMinAiScore] = useState(0);
  const [demoteLowTier, setDemoteLowTier] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await agentService.getSourceQualityStatus();
      setStatus(data);
      setBlacklist(data.sourceBlacklist.join('\n'));
      setWhitelist(data.sourceWhitelist.join('\n'));
      setMinAiScore(data.minAiScore);
      setDemoteLowTier(data.demoteLowTier);
      setError(null);
    } catch (err) {
      setError(getOpsErrorMessage(err, '无法加载来源质量配置'));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await agentService.updateSourceQualityConfig({
        sourceBlacklist: splitLines(blacklist),
        sourceWhitelist: splitLines(whitelist),
        minAiScore,
        demoteLowTier,
        blockedTiers: status?.blockedTiers ?? []
      });
      await load();
    } catch (err) {
      setSaveError(getOpsErrorMessage(err, '保存来源质量配置失败'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && <OpsErrorBanner message={error} onRetry={load} />}
      {saveError && (
        <OpsErrorBanner
          message={saveError}
          onRetry={() => setSaveError(null)}
          retryLabel="关闭"
        />
      )}

      {!status && !error && (
        <div className="py-12 text-center text-sm text-text-slate dark:text-text-secondary">加载中...</div>
      )}

      {status && (
        <>
          <QualitySummary
            status={status}
            minAiScore={minAiScore}
            onMinAiScoreChange={setMinAiScore}
            onSaveMinScore={save}
            saving={saving}
          />
          <QualityRulesPanel
            status={status}
            blacklist={blacklist}
            whitelist={whitelist}
            demoteLowTier={demoteLowTier}
            saving={saving}
            onBlacklistChange={setBlacklist}
            onWhitelistChange={setWhitelist}
            onDemoteLowTierChange={setDemoteLowTier}
            onSave={save}
          />
        </>
      )}
    </div>
  );
};
