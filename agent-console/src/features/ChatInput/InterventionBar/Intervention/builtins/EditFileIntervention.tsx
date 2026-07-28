import { Flexbox } from '@lobehub/ui';
import { memo } from 'react';

import { FileChangeDiff } from '../../../../../components/FileChangeDiff';
import { InterventionSection } from '../../InterventionSection';
import { interventionStyles } from '../../interventionStyles';
import type { BuiltinInterventionProps } from '../types';
import { FilePathLabel } from './FilePathLabel';

export const EditFileIntervention = memo(function EditFileIntervention({
  args,
}: BuiltinInterventionProps) {
  const path = typeof args.path === 'string' ? args.path : '';
  const search = typeof args.search === 'string' ? args.search : '';
  const replace = typeof args.replace === 'string' ? args.replace : '';
  const all = args.all === true;

  return (
    <Flexbox gap={12}>
      <InterventionSection
        description="批准后将按以下 diff 修改文件内容。"
        title="文件编辑"
      >
        <FilePathLabel path={path} />
        {all ? (
          <div className={interventionStyles.metaRow}>
            <span className={interventionStyles.metaChip}>全部替换</span>
          </div>
        ) : null}
      </InterventionSection>
      {search || replace ? (
        <FileChangeDiff
          className={interventionStyles.codeBlock}
          kind="modify"
          maxHeight={400}
          newContent={replace}
          oldContent={search}
          path={path}
          showHeader={false}
          variant="outlined"
        />
      ) : null}
    </Flexbox>
  );
});
