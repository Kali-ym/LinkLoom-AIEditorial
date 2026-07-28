import { useEffect } from 'react';

import { HotkeyScopeEnum } from '../../constants/hotkeyRegistry';
import { useHotkeysContext } from './HotkeysProvider';
import { useHotkeyById } from './useHotkeyById';

/** §C.55*/
export function useRegisterFilesHotkeys(onSave: () => void): void {
  const { enableScope, disableScope } = useHotkeysContext();

  useHotkeyById('saveDocument', () => onSave(), { enableOnContentEditable: true });

  useEffect(() => {
    enableScope(HotkeyScopeEnum.Files);
    return () => disableScope(HotkeyScopeEnum.Files);
  }, [disableScope, enableScope]);
}
