import { memo } from 'react';

import type { PendingIntervention } from '../../../domain/types';
import { Intervention } from './Intervention';
import { interventionStyles } from './interventionStyles';

/** §C.36*/
export const InterventionContent = memo(function InterventionContent({
  intervention,
  actionsPortalTarget,
  topicId,
}: {
  intervention: PendingIntervention;
  actionsPortalTarget: HTMLDivElement | null;
  topicId: string;
}) {
  return (
    <div className={interventionStyles.content}>
      <div className={interventionStyles.contentInner}>
        <Intervention
        actionsPortalTarget={actionsPortalTarget}
        allowedActions={intervention.allowedActions}
        apiName={intervention.apiName}
        assistantGroupId={intervention.assistantGroupId}
        assistantMessageId={intervention.assistantMessageId}
        hitlKind={intervention.hitlKind}
        hitlPrompt={intervention.hitlPrompt}
        identifier={intervention.identifier}
        key={intervention.toolCallId}
        permissionId={intervention.permissionId}
        requestArgs={intervention.requestArgs}
        toolCallId={intervention.toolCallId}
        toolMessageId={intervention.toolMessageId}
        topicId={topicId}
        />
      </div>
    </div>
  );
});
