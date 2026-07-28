import { Flexbox } from '@lobehub/ui';
import { memo } from 'react';

import { useWorkingSidebarAvailability } from '../../../hooks/useWorkingSidebarAvailability';
import { AgentDocumentsGroup } from './AgentDocumentsGroup';

/** §C.27*/
export const ResourcesSection = memo(function ResourcesSection() {
  const { workingDirectory, isLocalSystemEnabled, isDeviceMode } = useWorkingSidebarAvailability();

  return (
    <Flexbox
      data-testid="workspace-resources"
      flex={1}
      gap={12}
      style={{ minHeight: 0, paddingBlock: 8, paddingInline: '8px 12px' }}
    >
      <AgentDocumentsGroup
        showProjectSkills={(isLocalSystemEnabled || isDeviceMode) && Boolean(workingDirectory)}
        style={{ flex: 1, minHeight: 0 }}
        workingDirectory={workingDirectory}
      />
    </Flexbox>
  );
});
