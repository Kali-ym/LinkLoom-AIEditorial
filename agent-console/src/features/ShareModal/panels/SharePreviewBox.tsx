import { cx } from 'antd-style';
import { type ReactNode, memo } from 'react';

import { shareModalStyles } from '../shareModalStyles';

interface SharePreviewBoxProps {
  children: ReactNode;
  narrow?: boolean;
}

export const SharePreviewBox = memo(function SharePreviewBox({
  children,
  narrow,
}: SharePreviewBoxProps) {
  return (
    <div
      className={cx(shareModalStyles.preview, narrow && shareModalStyles.previewNarrow)}
      style={{ padding: 12 }}
    >
      {children}
    </div>
  );
});
