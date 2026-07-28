import { memo } from 'react';

import { ToolArgsPreview } from '../../shared/ToolArgsPreview';

/** §C.45 — generic render for tools without a builtin renderer */
export const FallbackArgumentRender = memo(function FallbackArgumentRender({
  content,
  requestArgs,
  toolCallId,
}: {
  content?: string;
  requestArgs?: string;
  toolCallId: string;
}) {
  return (
    <ToolArgsPreview
      arguments={requestArgs}
      content={content}
      toolCallId={toolCallId}
    />
  );
});
