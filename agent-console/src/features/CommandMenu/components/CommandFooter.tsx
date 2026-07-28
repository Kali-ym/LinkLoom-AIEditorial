import { ArrowUpDown, CornerDownLeft } from 'lucide-react';
import { memo } from 'react';

import { commandStrings } from '../commandStrings';
import { commandMenuStyles as styles } from '../styles';

/** §C.41*/
export const CommandFooter = memo(function CommandFooter() {
  return (
    <div className={styles.commandFooter}>
      <div className={styles.kbd}>
        <CornerDownLeft className={styles.kbdIcon} />
        <span>{commandStrings.footer.open}</span>
      </div>
      <div className={styles.kbd}>
        <ArrowUpDown className={styles.kbdIcon} />
        <span>{commandStrings.footer.select}</span>
      </div>
    </div>
  );
});
