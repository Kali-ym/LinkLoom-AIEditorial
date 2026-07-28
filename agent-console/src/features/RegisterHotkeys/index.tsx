import { memo } from 'react';

import { useRegisterChatHotkeys, useRegisterGlobalHotkeys } from '../../hooks/useHotkeys';

/** §C.55*/
export const RegisterHotkeys = memo(function RegisterHotkeys() {
  useRegisterGlobalHotkeys();
  useRegisterChatHotkeys();
  return null;
});
