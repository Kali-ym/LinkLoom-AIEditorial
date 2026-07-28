import { Flexbox } from '@lobehub/ui';
import { memo } from 'react';

import { InterventionPanel, InterventionSection } from '../../InterventionSection';
import { interventionStyles } from '../../interventionStyles';
import type { BuiltinInterventionProps } from '../types';
import { MoveFileItem } from './MoveFileItem';

interface MoveItem {
  newPath?: string;
  oldPath?: string;
}

export const MoveFilesIntervention = memo(function MoveFilesIntervention({
  args,
}: BuiltinInterventionProps) {
  const items = Array.isArray(args.items) ? (args.items as MoveItem[]) : [];

  return (
    <Flexbox gap={12}>
      <InterventionSection
        description="批准后将按下列路径映射移动或重命名文件。"
        title="批量移动"
      >
        <div className={interventionStyles.metaRow}>
          <span className={interventionStyles.metaChip}>{items.length} 个文件</span>
        </div>
      </InterventionSection>
      <InterventionPanel padded={false}>
        <Flexbox gap={2} style={{ paddingBlock: 4, paddingInline: 6 }}>
          {items.map((item, index) => (
            <MoveFileItem key={`move-${index}`} newPath={item.newPath} oldPath={item.oldPath} />
          ))}
        </Flexbox>
      </InterventionPanel>
    </Flexbox>
  );
});
