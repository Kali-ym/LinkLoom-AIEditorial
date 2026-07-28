import { cx } from 'antd-style';
import { memo, useState } from 'react';

import type { PendingIntervention } from '../../../domain/types';
import { useTopicStore } from '../../../stores';
import { InterventionChrome } from './InterventionChrome';
import { InterventionContent } from './InterventionContent';
import { interventionStyles } from './interventionStyles';

export const InterventionBar = memo(function InterventionBar({
  interventions,
}: {
  interventions: PendingIntervention[];
}) {
  const activeTopicId = useTopicStore((s) => s.activeTopicId);
  const [actionsPortalTarget, setActionsPortalTarget] = useState<HTMLDivElement | null>(null);

  const activeIntervention = interventions[0];
  if (!activeIntervention) return null;

  return (
    <div className={cx(interventionStyles.container, interventionStyles.shell)}>
      <InterventionChrome intervention={activeIntervention} />
      <InterventionContent
        actionsPortalTarget={actionsPortalTarget}
        intervention={activeIntervention}
        topicId={activeTopicId}
      />
      <div className={interventionStyles.actions} ref={setActionsPortalTarget} />
    </div>
  );
});
