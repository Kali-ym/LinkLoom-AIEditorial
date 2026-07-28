import { Alert, Button } from '@lobehub/ui';
import { memo } from 'react';

import { useAgentConfigStatus } from '../../hooks/data/useAgentConfigStatus';

/** §C.18 AgentConfigError*/
export const AgentConfigError = memo(function AgentConfigError() {
  const { configError, isConfigLoading, retryAgentConfigFetch } = useAgentConfigStatus();

  if (isConfigLoading || !configError) return null;

  return (
    <Alert
      showIcon
      action={
        <Button size="small" onClick={() => void retryAgentConfigFetch()}>
          重试
        </Button>
      }
      description={configError}
      message="无法加载 Agent 配置"
      style={{ marginBlockEnd: 8 }}
      type="error"
    />
  );
});
