import { memo } from 'react';

import { supervisorMessageStyles } from './specialMessageStyles';

/** §C.17 — 对齐 Messages/Supervisor */
export const SupervisorMessage = memo(function SupervisorMessage({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={supervisorMessageStyles.root} data-msg-type="supervisor">
      {children}
    </div>
  );
});
