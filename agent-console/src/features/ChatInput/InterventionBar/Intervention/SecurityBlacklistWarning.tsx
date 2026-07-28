import { Alert, Flexbox } from '@lobehub/ui';
import { memo, useMemo } from 'react';

import { checkSecurityBlacklist } from '../../../../hooks/data/useRuntime';

interface SecurityBlacklistWarningProps {
  args: Record<string, unknown>;
}

/** §C.36*/
export const SecurityBlacklistWarning = memo(function SecurityBlacklistWarning({
  args,
}: SecurityBlacklistWarningProps) {
  const securityCheck = useMemo(() => checkSecurityBlacklist(args), [args]);
  if (!securityCheck.blocked) return null;

  return (
    <Alert
      showIcon
      title="安全黑名单拦截"
      type="error"
      variant="filled"
      description={
        <Flexbox gap={4} style={{ fontSize: 12 }}>
          <div>{securityCheck.reason}</div>
        </Flexbox>
      }
    />
  );
});
