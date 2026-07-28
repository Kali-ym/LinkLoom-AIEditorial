import React, { useState, useEffect, useCallback } from 'react';
import { agentService } from '../../../../../services/agentService';
import type { GovernanceStatus } from '../../../../../services/agentService';
import { getOpsErrorMessage, OpsErrorBanner, OpsRefreshButton } from '../../../opsUiPrimitives';
import { GovernanceMatrixPanel } from './GovernanceMatrixPanel';
import { GovernanceSummary } from './GovernanceSummary';

export const GovernanceTab: React.FC = () => {
  const [status, setStatus] = useState<GovernanceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await agentService.getGovernanceStatus();
      setStatus(data);
      setError(null);
    } catch (err) {
      setError(getOpsErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 20000);
    return () => clearInterval(timer);
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] text-text-charcoal dark:text-text-secondary">
          工具权限策略与平台治理 · 策略版本 {status?.policyVersion || 'platform-v1'}
        </p>
        <OpsRefreshButton onClick={load} disabled={loading} />
      </div>

      {error && <OpsErrorBanner message={error} onRetry={load} />}

      {loading && !status && !error && (
        <div className="py-12 text-center text-sm text-text-slate dark:text-text-secondary">加载中...</div>
      )}

      {status && (
        <>
          <GovernanceSummary status={status} />
          <GovernanceMatrixPanel status={status} />
        </>
      )}
    </div>
  );
};
