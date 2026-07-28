import { memo } from 'react';

import { safeParsePartialJSON } from '../../../../../utils/safeParsePartialJSON';
import { getBuiltinStreaming } from '../Streaming/registry';
import { ToolArgsPreview } from '../shared/ToolArgsPreview';
import { hasBuiltinPreview, renderBuiltinPreview } from './renderBuiltinPreview';

/** §C.43*/
export const LoadingPlaceholder = memo(function LoadingPlaceholder({
  apiName,
  identifier,
  loading,
  messageId,
  requestArgs,
  toolCallId,
}: {
  apiName: string;
  identifier: string;
  loading?: boolean;
  messageId: string;
  requestArgs?: string;
  toolCallId: string;
}) {
  const StreamRender = getBuiltinStreaming(identifier, apiName);
  if (StreamRender) {
    return (
      <StreamRender
        apiName={apiName}
        args={safeParsePartialJSON(requestArgs)}
        identifier={identifier}
        messageId={messageId}
        toolCallId={toolCallId}
      />
    );
  }

  if (hasBuiltinPreview(identifier, apiName)) {
    return renderBuiltinPreview({
      apiName,
      identifier,
      messageId,
      requestArgs,
      toolCallId,
    });
  }

  return <ToolArgsPreview arguments={requestArgs} loading={loading} />;
});
