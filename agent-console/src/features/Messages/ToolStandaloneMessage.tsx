import { memo } from 'react';

import { toolStandaloneMessageStyles } from './specialMessageStyles';

/** §C.17 standalone tool line */
export const ToolStandaloneMessage = memo(function ToolStandaloneMessage({ text }: { text: string }) {
  return (
    <div className={toolStandaloneMessageStyles.root} data-msg-type="tool">
      {text}
    </div>
  );
});
