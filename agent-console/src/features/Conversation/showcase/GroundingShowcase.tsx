import { memo } from 'react';

import { useWorkspaceStore } from '../../../stores';
import { GroundingMessage } from '../../Messages/GroundingMessage';
import { ShowcasePanel } from './ShowcasePanel';
import { showcaseStyles } from './showcaseStyles';

/** index.html `#groundingDemoMount` */
export const GroundingShowcase = memo(function GroundingShowcase() {
  const grounding = useWorkspaceStore((s) => s.showcase.grounding);

  return (
    <ShowcasePanel itemKey="grounding" title={grounding.title}>
      <div className={showcaseStyles.groundingDemoGrid} id="groundingDemoMount">
        <GroundingMessage data={grounding.web} defaultExpanded />
        <GroundingMessage data={grounding.images} defaultExpanded />
      </div>
    </ShowcasePanel>
  );
});
