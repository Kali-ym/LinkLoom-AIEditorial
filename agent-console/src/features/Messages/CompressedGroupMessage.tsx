import { memo } from 'react';

import { compressedGroupMessageStyles } from './specialMessageStyles';

/** §C.17 compressed group summary */
export const CompressedGroupMessage = memo(function CompressedGroupMessage({
  summary,
}: {
  summary: string;
}) {
  return (
    <div
      className={compressedGroupMessageStyles.root}
      data-msg-type="compressedGroup"
      role="button"
      tabIndex={0}
    >
      {summary}
    </div>
  );
});
