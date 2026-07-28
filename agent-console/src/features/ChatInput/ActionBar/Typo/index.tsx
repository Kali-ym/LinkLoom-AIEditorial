import { ActionIcon, Tooltip } from '@lobehub/ui';
import { Type } from 'lucide-react';
import { memo } from 'react';

import { useInputStore } from '../../../../stores';
import { typoBarStrings } from '../../TypoBar/typoBarStrings';

/** §C.48 / §C.57*/
export const Typo = memo(function Typo() {
  const visible = useInputStore((s) => s.typoBarVisible);
  const setVisible = useInputStore((s) => s.setTypoBarVisible);
  const label = visible ? typoBarStrings.actionsOff : typoBarStrings.actionsOn;

  return (
    <Tooltip title={label}>
      <span style={{ display: 'inline-flex' }}>
        <ActionIcon
          active={visible}
          icon={Type}
          size="small"
          onClick={() => setVisible(!visible)}
        />
      </span>
    </Tooltip>
  );
});
