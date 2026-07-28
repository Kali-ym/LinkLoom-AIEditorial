import { Flexbox, Text } from '@lobehub/ui';
import { memo } from 'react';

import { shinyTextStyles } from '../../../styles/shinyTextStyles';
import { ThinkingStatusIndicator } from './StatusIndicator';

/** §C.3 Thinking title — shiny when streaming, secondary when done */
export const ThinkingTitle = memo(function ThinkingTitle({
  label,
  showDetail,
  thinking,
}: {
  label: string;
  showDetail?: boolean;
  thinking?: boolean;
}) {
  return (
    <Flexbox horizontal align="center" gap={6}>
      <ThinkingStatusIndicator showDetail={showDetail} thinking={thinking} />
      {thinking ? (
        <span className={shinyTextStyles.shinyText}>思考中…</span>
      ) : (
        <Text type="secondary">{label}</Text>
      )}
    </Flexbox>
  );
});
