import { useCallback } from 'react';

import { usePermission } from '../../../../hooks/usePermission';

interface UsePanelHandlersProps {
  onModelChange?: (params: { model: string; provider: string }) => void | Promise<void>;
  onOpenChange?: (open: boolean) => void;
}

export function usePanelHandlers({ onModelChange, onOpenChange }: UsePanelHandlersProps) {
  const { allowed: canCreateContent } = usePermission('create_content');

  const handleModelChange = useCallback(
    (modelId: string, providerId: string) => {
      setTimeout(() => {
        if (!canCreateContent) return;
        void onModelChange?.({ model: modelId, provider: providerId });
      }, 150);
    },
    [canCreateContent, onModelChange],
  );

  const handleClose = useCallback(() => {
    onOpenChange?.(false);
  }, [onOpenChange]);

  return { handleClose, handleModelChange };
}
