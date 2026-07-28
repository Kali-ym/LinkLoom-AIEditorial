import { Markdown, SyntaxHighlighter } from '@lobehub/ui';
import { Flexbox } from '@lobehub/ui';
import type { FC, ReactNode } from 'react';
import { memo } from 'react';

import { resolveToolUIPayload } from '../../hooks/data/usePortal';
import { normalizeToolPluginId } from '../../hooks/data/useToolPortal';
import type { PortalViewPayload } from '../../domain/types/portalView';
import { DeliveryCheckerPortalActions } from './plugins/deliveryChecker/DeliveryCheckerActions';
import { DeliveryCheckerPortalBody } from './plugins/deliveryChecker/DeliveryCheckerPortal';
import {
  DeliveryCheckerPortalTitle,
  WebBrowsingPortalTitle,
} from './plugins/ToolPortalChrome';
import { WebBrowsingPortalBody } from './plugins/webBrowsing';
import type { ToolPortalProps } from './types';

const DefaultToolBody = memo(function DefaultToolBody({ payload }: ToolPortalProps) {
  const p = resolveToolUIPayload(payload);
  const argsJson = JSON.stringify(p.args, null, 2);

  return (
    <Flexbox gap={12}>
      <SyntaxHighlighter language="json" style={{ fontSize: 12 }} variant="borderless">
        {argsJson}
      </SyntaxHighlighter>
      {p.result ? <Markdown variant="chat">{p.result}</Markdown> : null}
    </Flexbox>
  );
});

const PLUGIN_BODIES: Record<string, FC<ToolPortalProps>> = {
  'linkloom-web-browsing': WebBrowsingPortalBody,
  'linkloom-delivery-checker': DeliveryCheckerPortalBody,
};

const PLUGIN_TITLES: Record<string, FC<{ payload: PortalViewPayload }>> = {
  'linkloom-web-browsing': WebBrowsingPortalTitle,
  'linkloom-delivery-checker': DeliveryCheckerPortalTitle,
};

const PLUGIN_ACTIONS: Record<string, FC<ToolPortalProps>> = {
  'linkloom-delivery-checker': DeliveryCheckerPortalActions,
};

function resolvePluginKey(payload: PortalViewPayload): string {
  const p = resolveToolUIPayload(payload);
  return normalizeToolPluginId(p.plugin);
}

/** §C.35 Builtin Tool Portal registry*/
export function resolveToolPortalBody(payload: PortalViewPayload): FC<ToolPortalProps> {
  const key = resolvePluginKey(payload);
  return PLUGIN_BODIES[key] ?? DefaultToolBody;
}

export function resolveToolPortalTitle(payload: PortalViewPayload): FC<{ payload: PortalViewPayload }> | null {
  const key = resolvePluginKey(payload);
  return PLUGIN_TITLES[key] ?? null;
}

export function resolveToolPortalActions(payload: PortalViewPayload): ReactNode {
  const key = resolvePluginKey(payload);
  const Actions = PLUGIN_ACTIONS[key];
  return Actions ? <Actions payload={payload} /> : null;
}
