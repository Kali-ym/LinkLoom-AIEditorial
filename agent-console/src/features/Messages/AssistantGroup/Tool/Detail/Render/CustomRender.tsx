import { Flexbox } from '@lobehub/ui';
import { Suspense, lazy, memo, useMemo, type ComponentType } from 'react';

import { safeParsePartialJSON } from '../../../../../../utils/safeParsePartialJSON';
import { loadBuiltinRenderRegistry } from '../../Render/registry';
import { toolRenderStyles } from '../../shared/toolRenderStyles';

function EmptyBuiltinRender() {
  return null;
}

/** §C.45 — resolve builtin render from a dynamically loaded registry chunk. */
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
  const Render = useMemo(() => {
    const LazyRender = lazy(async () => {
      const registry = await loadBuiltinRenderRegistry();
      const Comp = registry.getBuiltinRender(identifier, apiName);
      return {
        default: (Comp ?? EmptyBuiltinRender) as ComponentType<{
          apiName: string;
          args: Record<string, unknown>;
          content: string;
          identifier: string;
          messageId: string;
          pluginState?: unknown;
          toolCallId: string;
        }>,
      };
    });
    return LazyRender;
  }, [apiName, identifier]);

  return (
    <Flexbox className={toolRenderStyles.shell} gap={12} id={toolCallId} width="100%">
      <Suspense fallback={null}>
        <Render
          apiName={apiName}
          args={safeParsePartialJSON(requestArgs)}
          content={content}
          identifier={identifier}
          messageId={messageId}
          pluginState={pluginState}
          toolCallId={toolCallId}
        />
      </Suspense>
    </Flexbox>
  );
});
