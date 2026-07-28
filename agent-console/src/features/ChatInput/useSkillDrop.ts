import type { IEditor } from '@lobehub/editor';
import { useCallback, type DragEvent, type RefObject } from 'react';

import type { ActionTagPayload } from '../../domain/types/actionTag';
import { SKILL_DRAG_MIME } from '../shared/skillDrag';
import { INSERT_ACTION_TAG_COMMAND } from './editor/ActionTag';

export function useSkillDrop(editorRef: RefObject<IEditor | null>) {
  const onDragOver = useCallback((event: DragEvent) => {
    if (!event.dataTransfer.types.includes(SKILL_DRAG_MIME)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      if (!event.dataTransfer.types.includes(SKILL_DRAG_MIME)) return;
      const raw = event.dataTransfer.getData(SKILL_DRAG_MIME);
      if (!raw) return;
      event.preventDefault();
      event.stopPropagation();
      try {
        const payload = JSON.parse(raw) as ActionTagPayload;
        if (!payload.category || !payload.label || !payload.type) return;
        const editor = editorRef.current;
        if (!editor) return;
        editor.focus();
        editor.dispatchCommand(INSERT_ACTION_TAG_COMMAND, {
          category: payload.category as ActionTagPayload['category'],
          label: payload.label,
          type: payload.type,
        });
      } catch {
        /* ignore */
      }
    },
    [editorRef],
  );

  return { onDragOver, onDrop };
}
