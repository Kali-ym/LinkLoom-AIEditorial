import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatedPillTabs } from '../../../../components/UI/ScrollablePillNav';
import {
  agentService,
  type Agent,
  type GovernanceStatus,
  type RegressionRunRecord,
  type SourceQualityStatus
} from '../../../../services/agentService';
import { GovernanceTab } from './governance/GovernanceTab';
import { PlatformStatusHeader } from './PlatformStatusHeader';
import { QualityTab } from './quality/QualityTab';
import { RegressionTab } from './regression/RegressionTab';
import { parsePlatformSection, type PlatformSection } from './shared/platformStatusUtils';

const PLATFORM_TABS: Array<{ id: PlatformSection; label: string }> = [
  { id: 'governance', label: '治理' },
  { id: 'quality', label: '质量门禁' },
  { id: 'regression', label: '回归' }
];

const HEADER_POLL_MS = 30_000;

export const PlatformOpsTab: React.FC<{ agents: Agent[] }> = ({ agents }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const section = parsePlatformSection(searchParams.get('section'));

  const [governance, setGovernance] = useState<GovernanceStatus | null>(null);
  const [quality, setQuality] = useState<SourceQualityStatus | null>(null);
  const [runs, setRuns] = useState<RegressionRunRecord[] | null>(null);
  const [errors, setErrors] = useState<{ governance?: boolean; quality?: boolean; regression?: boolean }>({});
  const [headerLoading, setHeaderLoading] = useState(true);

  const loadHeader = useCallback(async () => {
    setHeaderLoading(true);
    const results = await Promise.allSettled([
      agentService.getGovernanceStatus(),
      agentService.getSourceQualityStatus(),
      agentService.listRegressionRuns(5)
    ]);

    const nextErrors: { governance?: boolean; quality?: boolean; regression?: boolean } = {};

    if (results[0].status === 'fulfilled') {
      setGovernance(results[0].value);
    } else {
      nextErrors.governance = true;
      setGovernance(null);
    }

    if (results[1].status === 'fulfilled') {
      setQuality(results[1].value);
    } else {
      nextErrors.quality = true;
      setQuality(null);
    }

    if (results[2].status === 'fulfilled') {
      setRuns(results[2].value);
    } else {
      nextErrors.regression = true;
      setRuns(null);
    }

    setErrors(nextErrors);
    setHeaderLoading(false);
  }, []);

  useEffect(() => {
    loadHeader();
    const timer = setInterval(loadHeader, HEADER_POLL_MS);
    return () => clearInterval(timer);
  }, [loadHeader]);

  const handleSectionChange = (next: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('tab', 'platform');
    if (next === 'governance') {
      params.delete('section');
    } else {
      params.set('section', next);
    }
    setSearchParams(params, { replace: true });
  };

  return (
    <div className="space-y-4">
      <PlatformStatusHeader
        governance={governance}
        quality={quality}
        runs={runs}
        errors={errors}
        loading={headerLoading}
        onRefresh={loadHeader}
      />
      <AnimatedPillTabs
        tabs={PLATFORM_TABS}
        active={section}
        onChange={handleSectionChange}
        layoutId="platform-sub-tabs"
        size="sm"
        aria-label="平台分区"
      />
      {section === 'governance' && <GovernanceTab />}
      {section === 'quality' && <QualityTab />}
      {section === 'regression' && <RegressionTab agents={agents} />}
    </div>
  );
};
