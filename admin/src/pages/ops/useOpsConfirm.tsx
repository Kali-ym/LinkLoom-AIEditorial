import { useCallback } from 'react';
import { useMessageDialog } from '../../context/MessageDialogContext';
import type { OpsConfirmOptions } from './opsUiPrimitives';

/** 运营中心确认弹窗：复用全局 MessageDialog，与 admin 其他页面一致 */
export function useOpsConfirm() {
  const { confirm: showConfirm } = useMessageDialog();

  const confirm = useCallback(
    (options: OpsConfirmOptions) =>
      showConfirm({
        title: options.title,
        message: options.message,
        confirmLabel: options.confirmLabel,
        cancelLabel: options.cancelLabel,
        confirmTone: options.tone === 'danger' ? 'danger' : 'default'
      }),
    [showConfirm]
  );

  return { confirm };
}
