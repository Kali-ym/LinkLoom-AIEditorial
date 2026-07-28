import type { IEditor } from '@lobehub/editor';
import { useCallback, useEffect } from 'react';

import { getFileListFromDataTransferItems } from './useLocalDragUpload';

/** §C.49*/
export function usePasteFile(
  editor: IEditor | undefined,
  onUploadFiles: (files: File[]) => void | Promise<void>,
  onPasteWithoutFiles?: () => void,
) {
  const handlePaste = useCallback(
    async (event: ClipboardEvent) => {
      if (!event.clipboardData) return;

      const items = Array.from(event.clipboardData.items);
      const files = await getFileListFromDataTransferItems(items);

      if (files.length === 0) {
        onPasteWithoutFiles?.();
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      void onUploadFiles(files);
    },
    [onPasteWithoutFiles, onUploadFiles],
  );

  useEffect(() => {
    if (!editor) return;

    editor.on('onPaste', handlePaste);

    return () => {
      editor.off('onPaste', handlePaste);
    };
  }, [editor, handlePaste]);
}
