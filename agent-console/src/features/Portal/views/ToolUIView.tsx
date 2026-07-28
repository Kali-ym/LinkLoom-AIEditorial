import { Flexbox } from '@lobehub/ui';
import { memo } from 'react';

import { resolveToolUIPayload } from '../../../hooks/data/usePortal';
import type { PortalViewPayload } from '../../../domain/types/portalView';
import { portalViewStyles } from '../portalViewStyles';
import { resolveToolPortalBody } from '../toolPortalRegistry';

/** §C.21/§C.35 ToolUI Body*/
export const ToolUIView = memo(function ToolUIView({ payload }: { payload: PortalViewPayload }) {
  const p = resolveToolUIPayload(payload);
  if (!p.plugin || !p.api) return null;

  const Body = resolveToolPortalBody(payload);

  return (
    <Flexbox
      className={portalViewStyles.scrollBody}
      flex={1}
      paddingInline={12}
      style={{ height: '100%', paddingBlock: 8 }}
    >
      <Body payload={payload} />
    </Flexbox>
  );
});
