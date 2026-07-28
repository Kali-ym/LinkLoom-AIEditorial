import { hasBuiltinRender } from '../Render/registry';
import { CustomRender } from './Render/CustomRender';

/** Use the skill's builtin render (e.g. TodoPanel) instead of raw argument rows. */
export function renderBuiltinPreview({
  apiName,
  content,
  identifier,
  messageId,
  pluginState,
  requestArgs,
  toolCallId,
}: {
  apiName: string;
  content?: string | null;
  identifier: string;
  messageId: string;
  pluginState?: unknown;
  requestArgs?: string;
  toolCallId: string;
}) {
  if (!hasBuiltinRender(identifier, apiName)) return null;

  return (
    <CustomRender
      apiName={apiName}
      content={content ?? ''}
      identifier={identifier}
      messageId={messageId}
      pluginState={pluginState}
      requestArgs={requestArgs}
      toolCallId={toolCallId}
    />
  );
}

export function hasBuiltinPreview(identifier: string, apiName: string) {
  return hasBuiltinRender(identifier, apiName);
}
