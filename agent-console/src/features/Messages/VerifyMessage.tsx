import { cssVar } from 'antd-style';
import { Check } from 'lucide-react';
import { memo } from 'react';

import { useWorkspaceStore } from '../../stores';
import { resetPortalView } from '../Portal';
import { verifyMessageStyles } from './verifyMessageStyles';

/** §A cssVar — 点击打开 VerifyResult portal */
export const VerifyMessage = memo(function VerifyMessage({
  title,
  assertion,
  onOpen,
}: {
  title: string;
  assertion: string;
  onOpen?: () => void;
}) {
  const verifyPayload = useWorkspaceStore((s) => s.showcase.portal.verifyResult);

  const handleClick = () => {
    onOpen?.();
    resetPortalView('VerifyResult', verifyPayload as Record<string, unknown>);
  };

  return (
    <div
      className={verifyMessageStyles.root}
      data-msg-type="verify"
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleClick();
        }
      }}
    >
      <div className={verifyMessageStyles.head}>
        <Check color={cssVar.colorSuccess} size={14} strokeWidth={2} />
        {title}
      </div>
      <div className={verifyMessageStyles.body}>{assertion}</div>
    </div>
  );
});
