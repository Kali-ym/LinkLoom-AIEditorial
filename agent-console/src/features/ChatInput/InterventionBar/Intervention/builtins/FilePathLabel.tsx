import { FileText } from 'lucide-react';
import { memo } from 'react';

import { InterventionPanel } from '../../InterventionSection';
import { interventionStyles } from '../../interventionStyles';

export const FilePathLabel = memo(function FilePathLabel({
  path,
  label,
}: {
  path?: string;
  label?: string;
}) {
  if (!path) return null;

  return (
    <InterventionPanel>
      <div className={interventionStyles.pathRow}>
        <span className={interventionStyles.pathIcon}>
          <FileText size={15} />
        </span>
        <div className={interventionStyles.pathCopy}>
          {label ? <span className={interventionStyles.pathLabel}>{label}</span> : null}
          <span className={interventionStyles.pathValue}>{path}</span>
        </div>
      </div>
    </InterventionPanel>
  );
});
