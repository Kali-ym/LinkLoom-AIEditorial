import { memo } from 'react';

import { ReasoningShowcase } from './showcase/ReasoningShowcase';
import { GroundingShowcase } from './showcase/GroundingShowcase';
import { ToolShowcase } from './showcase/ToolShowcase';
import { PortalShowcase } from './showcase/PortalShowcase';
import { SkillShowcase } from './showcase/SkillShowcase';
import { MsgTypesShowcase } from './showcase/MsgTypesShowcase';

/** index.html `#messages` 内虚线折叠示例 — 对话态始终挂载 */
export const ShowcaseSection = memo(function ShowcaseSection() {
  return (
    <>
      <ReasoningShowcase />
      <GroundingShowcase />
      <ToolShowcase />
      <PortalShowcase />
      <SkillShowcase />
      <MsgTypesShowcase />
    </>
  );
});
