import { memo } from 'react';

import { getBuiltinRender } from '../../Render/registry';
import { CustomRender } from './CustomRender';
import { FallbackArgumentRender } from './FallbackArgumentRender';

/** §C.45*/
export const ToolRender = memo(function ToolRender({
  apiName,
  content,
  identifier,
  messageId,
  pluginState,
  requestArgs,
  showCustomToolRender,
  toolCallId,
}: {
  apiName: string;
  content: string;
  identifier: string;
  messageId: string;
  pluginState?: unknown;
  requestArgs?: string;
  showCustomToolRender?: boolean;
  toolCallId: string;
}) {
  const hasCustomRender = Boolean(getBuiltinRender(identifier, apiName));

  if (hasCustomRender && showCustomToolRender) {
    return (
      <CustomRender
        apiName={apiName}
        content={content}
        identifier={identifier}
        messageId={messageId}
        pluginState={pluginState}
        requestArgs={requestArgs}
        toolCallId={toolCallId}
      />
    );
  }

  return (
    <FallbackArgumentRender content={content} requestArgs={requestArgs} toolCallId={toolCallId} />
  );
});
