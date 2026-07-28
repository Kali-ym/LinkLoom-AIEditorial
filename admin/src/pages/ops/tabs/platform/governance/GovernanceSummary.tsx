import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { GovernanceStatus } from '../../../../../services/agentService';
import { FeatureCard, StatCard } from '../shared/governanceUi';

type Props = {
  status: GovernanceStatus;
};

export const GovernanceSummary: React.FC<Props> = ({ status }) => {
  const navigate = useNavigate();
  const hasPending = status.pendingPermissions > 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="需审批工具" value={status.askCount} accent="text-amber-600" />
        <StatCard
          label="待审批运行"
          value={status.pendingPermissions}
          accent={hasPending ? 'text-amber-600' : 'text-blue-600'}
          onClick={hasPending ? () => navigate('/ops?tab=inbox') : undefined}
        />
        <StatCard label="工具总数" value={status.toolCount} />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <FeatureCard
          title="外部内容标记"
          enabled={status.externalContentGuardEnabled}
          description="检测 URL / HTML / 注入短语，写入治理事件供审计"
        />
        <FeatureCard
          title="输出风险校验"
          enabled={status.outputValidationEnabled}
          description="拦截可疑 shell 模式，在输出 metadata 中标记警告"
        />
      </div>
    </div>
  );
};
