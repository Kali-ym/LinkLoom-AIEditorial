import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import { memo, type PropsWithChildren, useEffect } from 'react';

import { AgentConsoleLocaleProvider } from '../../i18n';

/** §C.60*/
export const LocaleProvider = memo(function LocaleProvider({ children }: PropsWithChildren) {
  useEffect(() => {
    dayjs.locale('zh-cn');
  }, []);

  return <AgentConsoleLocaleProvider>{children}</AgentConsoleLocaleProvider>;
});
