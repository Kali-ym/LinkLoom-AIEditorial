import { ActionIcon, Flexbox } from '@lobehub/ui';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { memo } from 'react';

import { resolveVerifyPlanState } from '../../../../hooks/data/useToolPortal';
import { openToolUI } from '../../portalActions';
import type { ToolPortalProps } from '../../types';

/** §C.35*/
export const DeliveryCheckerPortalActions = memo(function DeliveryCheckerPortalActions({
  payload,
}: ToolPortalProps) {
  const params = payload.toolUIParams;
  const plan = resolveVerifyPlanState(payload);
  const total = plan.items?.length ?? 0;
  const index = typeof params?.index === 'number' ? params.index : 0;

  if (params?.view === 'rubric' || total <= 1) return null;

  const go = (next: number) => {
    openToolUI({
      ...payload,
      toolUIParams: { ...params, index: next },
    });
  };

  return (
    <Flexbox horizontal gap={2}>
      <ActionIcon
        disabled={index <= 0}
        icon={ChevronUp}
        size="small"
        title="上一项"
        onClick={() => go(index - 1)}
      />
      <ActionIcon
        disabled={index >= total - 1}
        icon={ChevronDown}
        size="small"
        title="下一项"
        onClick={() => go(index + 1)}
      />
    </Flexbox>
  );
});
