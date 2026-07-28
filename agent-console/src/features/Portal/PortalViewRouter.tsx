import { memo } from 'react';

import type { PortalViewPayload } from '../../domain/types/portalView';
import type { PortalViewType } from '../../stores/types';
import { PORTAL_VIEW_REGISTRY } from './portalRegistry';

/** §C.21 Portal Body 路由 — 由 registry 驱动 */
export const PortalViewRouter = memo(function PortalViewRouter({
  type,
  payload,
}: {
  type: PortalViewType;
  payload: PortalViewPayload;
}) {
  const impl = PORTAL_VIEW_REGISTRY[type];
  if (!impl) return null;
  const Body = impl.Body;
  return <Body payload={payload} />;
});
