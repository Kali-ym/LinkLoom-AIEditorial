import { memo } from 'react';

import type { PortalViewPayload } from '../../../../domain/types/portalView';
import type { ToolPortalProps } from '../../types';
import { PageContentPortalBody } from './PageContentPortal';
import { PageContentsPortalBody } from './PageContentsPortal';
import { SearchPortalBody } from './SearchPortal';

export const WebBrowsingPortalBody = memo(function WebBrowsingPortalBody({
  payload,
}: ToolPortalProps) {
  const api = payload.api ?? 'search';
  switch (api) {
    case 'search':
      return <SearchPortalBody payload={payload} />;
    case 'crawlSinglePage':
      return <PageContentPortalBody payload={payload} />;
    case 'crawlMultiPages':
      return <PageContentsPortalBody payload={payload} />;
    default:
      return <PageContentPortalBody payload={payload} />;
  }
});

export function webBrowsingTitle(_payload: PortalViewPayload): string {
  return '网页搜索';
}
