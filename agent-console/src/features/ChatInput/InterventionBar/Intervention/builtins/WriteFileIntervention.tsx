import { Flexbox } from '@lobehub/ui';
import { memo } from 'react';

import { FileChangeDiff } from '../../../../../components/FileChangeDiff';
import { InterventionSection } from '../../InterventionSection';
import { interventionStyles } from '../../interventionStyles';
import type { BuiltinInterventionProps } from '../types';
import { FilePathLabel } from './FilePathLabel';

export const WriteFileIntervention = memo(function WriteFileIntervention({
  args,
}: BuiltinInterventionProps) {
  const path = typeof args.path === 'string' ? args.path : '';
  const content = typeof args.content === 'string' ? args.content : '';
  const lineCount = content ? content.split('\n').length : 0;

  return (
    <Flexbox gap={12}>
      <InterventionSection
        description="批准后将写入或覆盖以下路径的文件。"
        title="文件写入"
      >
        <FilePathLabel path={path} />
        {lineCount > 0 ? (
          <div className={interventionStyles.metaRow}>
            <span className={interventionStyles.metaChip}>{lineCount} 行</span>
          </div>
        ) : null}
      </InterventionSection>
      {content ? (
        <FileChangeDiff
          className={interventionStyles.codeBlock}
          kind="create"
          maxHeight={400}
          newContent={content}
          path={path}
          variant="outlined"
        />
      ) : null}
    </Flexbox>
  );
});
