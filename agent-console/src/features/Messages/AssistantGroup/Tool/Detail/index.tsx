import { memo } from 'react';

import { safeParsePartialJSON } from '../../../../../utils/safeParsePartialJSON';
import { getBuiltinStreaming } from '../Streaming/registry';
import { LoadingPlaceholder } from './LoadingPlaceholder';
import { ToolRender } from './Render';
import { renderBuiltinPreview } from './renderBuiltinPreview';

/** §C.43 / §C.45*/
export const ToolDetail = memo(function ToolDetail({
  apiName,
  disableEditing,
  fallbackResult,
  identifier,
  intervention,
  isArgumentsStreaming,
  isToolCalling,
  messageId,
  onOpenPortal,
  pluginState,
  requestArgs,
  showCustomToolRender,
  toolCallId,
  toolMessageId,
}: {
  apiName: string;
  disableEditing?: boolean;
  fallbackResult?: string;
  identifier: string;
  intervention?: { status?: string; rejectedReason?: string };
  isArgumentsStreaming: boolean;
  isToolCalling: boolean;
  messageId: string;
  onOpenPortal?: () => void;
  pluginState?: unknown;
  requestArgs?: string;
  showCustomToolRender: boolean;
  toolCallId: string;
  toolMessageId?: string;
}) {
  if (toolMessageId && intervention?.status === 'pending' && !disableEditing) {
    return null;
  }

  const hasResult = Boolean(fallbackResult?.trim());
  const StreamingRenderer = getBuiltinStreaming(identifier, apiName);

  if (isArgumentsStreaming || (!hasResult && StreamingRenderer)) {
    if (StreamingRenderer) {
      const args = safeParsePartialJSON(requestArgs);
      return (
        <StreamingRenderer
          apiName={apiName}
          args={args}
          identifier={identifier}
          messageId={messageId}
          toolCallId={toolCallId}
        />
      );
    }

    const preview = renderBuiltinPreview({
      apiName,
      content: fallbackResult,
      identifier,
      messageId,
      pluginState,
      requestArgs,
      toolCallId,
    });
    if (preview) return preview;

    return null;
  }

  if (isToolCalling) {
    return (
      <LoadingPlaceholder
        loading
        apiName={apiName}
        identifier={identifier}
        messageId={messageId}
        requestArgs={requestArgs}
        toolCallId={toolCallId}
      />
    );
  }

  if (!hasResult && !showCustomToolRender) {
    return null;
  }

  return (
    <>
      <ToolRender
        apiName={apiName}
        content={fallbackResult ?? ''}
        identifier={identifier}
        messageId={messageId}
        pluginState={pluginState}
        requestArgs={requestArgs}
        showCustomToolRender={showCustomToolRender}
        toolCallId={toolCallId}
      />
      {fallbackResult && onOpenPortal ? (
        <button
          type="button"
          className="btn btn-ghost open-portal-btn"
          style={{ fontSize: 12, padding: '4px 10px', width: 'fit-content' }}
          onClick={onOpenPortal}
        >
          在 Portal 中查看详情 →
        </button>
      ) : null}
    </>
  );
});
