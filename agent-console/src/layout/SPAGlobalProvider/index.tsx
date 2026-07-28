import { TooltipGroup } from '@lobehub/ui';
import { StyleProvider } from 'antd-style';
import { domAnimation, LazyMotion } from 'framer-motion';
import { lazy, memo, type PropsWithChildren, Suspense } from 'react';

import { DragUploadProvider } from '../../components/DragUploadZone';
import { LocaleProvider } from './LocaleProvider';
import { QueryProvider } from './QueryProvider';

const ModalHost = lazy(() => import('@lobehub/ui').then((m) => ({ default: m.ModalHost })));
const BaseModalHost = lazy(() =>
  import('@lobehub/ui/base-ui').then((m) => ({ default: m.ModalHost })),
);
const ToastHost = lazy(() => import('@lobehub/ui/base-ui').then((m) => ({ default: m.ToastHost })));
const ContextMenuHost = lazy(() =>
  import('@lobehub/ui').then((m) => ({ default: m.ContextMenuHost })),
);

/**
 * §C.60
 *
 * 聚合全局拖放检测与 Modal/Toast/ContextMenu portal hosts。
 * `AgentConsoleThemeProvider` + `EditorProvider` 保留在 `AgentConsolePage` 外层。
 */
export const SPAGlobalProvider = memo(function SPAGlobalProvider({ children }: PropsWithChildren) {
  return (
    <LocaleProvider>
      <QueryProvider>
        <LazyMotion features={domAnimation} strict>
          <DragUploadProvider>
            <TooltipGroup layoutAnimation={false}>
              <StyleProvider speedy={import.meta.env.PROD}>{children}</StyleProvider>
            </TooltipGroup>
            <Suspense fallback={null}>
              <ModalHost />
              <BaseModalHost />
              <ToastHost />
              <ContextMenuHost />
            </Suspense>
          </DragUploadProvider>
        </LazyMotion>
      </QueryProvider>
    </LocaleProvider>
  );
});
