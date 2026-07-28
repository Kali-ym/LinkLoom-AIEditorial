import { Text } from '@lobehub/ui';
import { memo, useState } from 'react';

import { useWorkspaceStore } from '../../../stores';
import { ActionTag } from '../../ChatInput/ActionTag';
import { ShowcasePanel } from './ShowcasePanel';
import { showcaseStyles } from './showcaseStyles';

/** index.html `#skillTagDemoMount` */
export const SkillShowcase = memo(function SkillShowcase() {
  const skills = useWorkspaceStore((s) => s.showcase.skills);
  const [selectedType, setSelectedType] = useState<string | null>(null);

  return (
    <ShowcasePanel itemKey="skills" title={skills.title}>
      <Text type="secondary" style={{ fontSize: 12, marginBottom: 10, display: 'block' }}>
        {skills.hint}
      </Text>
      <div className={showcaseStyles.skillTagDemoRow} id="skillTagDemoMount">
        {skills.tagDemos.map((tag) => (
          <ActionTag
            key={tag.type}
            payload={tag}
            selected={selectedType === tag.type}
            onSelect={() => setSelectedType(tag.type)}
          />
        ))}
      </div>
    </ShowcasePanel>
  );
});
