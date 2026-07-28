import { Text } from '@lobehub/ui';
import { memo } from 'react';
import { resolvePortalTitle as portalTitle } from '../../../hooks/data/usePortal';
import type { PortalViewPayload } from '../../../domain/types/portalView';
import { usePortalStore } from '../../../stores';
import { PORTAL_VIEW_REGISTRY } from '../portalRegistry';
import { DefaultPortalHeader } from './DefaultPortalHeader';

/** §C.21 Portal Chrome — 按 registry 渲染自定义 Header 或默认 Header + Title */
export const PortalChrome = memo(function PortalChrome() {
  const current = usePortalStore((s) => s.stack[s.stack.length - 1]);
  if (!current) return null;

  const impl = PORTAL_VIEW_REGISTRY[current.type];
  const payload = current.payload as PortalViewPayload;

  if (impl.Header) {
    return <impl.Header payload={payload} />;
  }

  const titleNode = impl.Title ? (
    <impl.Title payload={payload} />
  ) : (
    <Text ellipsis fontSize={16} id="portalViewTitle" type="secondary">
      {portalTitle(current.type, payload)}
    </Text>
  );

  return <DefaultPortalHeader title={titleNode} rightExtra={impl.rightExtra?.(payload)} />;
});
