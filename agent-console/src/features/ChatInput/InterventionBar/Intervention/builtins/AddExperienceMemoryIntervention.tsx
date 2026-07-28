import { Flexbox } from '@lobehub/ui';
import { memo } from 'react';

import { InterventionSection } from '../../InterventionSection';
import type { BuiltinInterventionProps } from '../types';
import { ExperienceMemoryCard, type ExperienceMemoryData } from './ExperienceMemoryCard';

export const AddExperienceMemoryIntervention = memo(function AddExperienceMemoryIntervention({
  args,
}: BuiltinInterventionProps) {
  const data: ExperienceMemoryData = {
    details: typeof args.details === 'string' ? args.details : undefined,
    keyLearning: typeof args.keyLearning === 'string' ? args.keyLearning : undefined,
    summary: typeof args.summary === 'string' ? args.summary : undefined,
    tags: Array.isArray(args.tags)
      ? args.tags.filter((tag): tag is string => typeof tag === 'string')
      : undefined,
    title: typeof args.title === 'string' ? args.title : undefined,
    withExperience:
      args.withExperience && typeof args.withExperience === 'object'
        ? (args.withExperience as ExperienceMemoryData['withExperience'])
        : undefined,
  };

  return (
    <Flexbox gap={12}>
      <InterventionSection
        description="批准后将把以下经验写入记忆库，供后续对话参考。"
        title="经验记忆"
      />
      <ExperienceMemoryCard data={data} />
    </Flexbox>
  );
});
