import { type ReactNode, createContext, memo, use, useCallback, useEffect, useRef, useState } from 'react';

import { detectDragContentKind, type DragContentKind } from './useLocalDragUpload';

interface DragUploadContextValue {
  dragContentKind: DragContentKind;
  isDraggingGlobally: boolean;
}

const DragUploadContext = createContext<DragUploadContextValue>({
  dragContentKind: 'none',
  isDraggingGlobally: false,
});

export const useDragUploadContext = () => use(DragUploadContext);

export const DragUploadProvider = memo(function DragUploadProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [isDraggingGlobally, setIsDraggingGlobally] = useState(false);
  const [dragContentKind, setDragContentKind] = useState<DragContentKind>('none');
  const dragCounter = useRef(0);

  const handleDragEnter = useCallback((e: DragEvent) => {
    if (!e.dataTransfer?.types.includes('Files')) return;

    e.preventDefault();
    dragCounter.current += 1;

    if (dragCounter.current === 1) {
      setIsDraggingGlobally(true);
      setDragContentKind(detectDragContentKind(e.dataTransfer.items));
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    if (!e.dataTransfer?.types.includes('Files')) return;
    e.preventDefault();
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    if (!e.dataTransfer?.types.includes('Files')) return;

    e.preventDefault();
    dragCounter.current -= 1;

    if (dragCounter.current === 0) {
      setIsDraggingGlobally(false);
      setDragContentKind('none');
    }
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDraggingGlobally(false);
    setDragContentKind('none');
  }, []);

  useEffect(() => {
    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, [handleDragEnter, handleDragOver, handleDragLeave, handleDrop]);

  return (
    <DragUploadContext value={{ dragContentKind, isDraggingGlobally }}>
      {children}
    </DragUploadContext>
  );
});
