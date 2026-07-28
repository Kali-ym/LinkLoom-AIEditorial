import { Flexbox } from '@lobehub/ui';
import { memo } from 'react';

import { safeParsePartialJSON } from '../../../../../../utils/safeParsePartialJSON';
import { getBuiltinRender } from '../../Render/registry';
import { toolRenderStyles } from '../../shared/toolRenderStyles';

/** §C.45*/
export const CustomRender = memo(function CustomRender({
  apiName,
  content,
  identifier,
  messageId,
  pluginState,
  requestArgs,
  toolCallId,
}: {
  apiName: string;
  content: string;
  identifier: string;
  messageId: string;
  pluginState?: unknown;
  requestArgs?: string;
  toolCallId: string;
}) {
  const Render = getBuiltinRender(identifier, apiName);
  if (!Render) return null;

  return (
    <Flexbox className={toolRenderStyles.shell} gap={12} id={toolCallId} width="100%">
      <Render
        apiName={apiName}
        args={safeParsePartialJSON(requestArgs)}
        content={content}
        identifier={identifier}
        messageId={messageId}
        pluginState={pluginState}
        toolCallId={toolCallId}
      />
    </Flexbox>
  );
});
