import { memo } from 'react';

import { Review } from './Review';

/** §C.16 Review panel mount — delegates to `Review/` module */
export const ReviewPanel = memo(function ReviewPanel() {
  return (
    <div id="reviewPanelMount" style={{ display: 'flex', flex: 1, flexDirection: 'column', minHeight: 0 }}>
      <Review />
    </div>
  );
});
