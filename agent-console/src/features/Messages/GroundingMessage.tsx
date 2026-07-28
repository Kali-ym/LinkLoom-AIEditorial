import { memo } from 'react';

import type { GroundingData } from '../../domain/types/grounding';
import { GroundingCard } from './GroundingCard';

/** index.html `#staticGrounding` / `#streamGrounding` — 可折叠搜索 Grounding 卡 */
export const GroundingMessage = memo(function GroundingMessage({
  data,
  defaultExpanded = false,
  id,
}: {
  data: GroundingData;
  defaultExpanded?: boolean;
  id?: string;
}) {
  return <GroundingCard data={data} defaultExpanded={defaultExpanded} id={id} />;
});
