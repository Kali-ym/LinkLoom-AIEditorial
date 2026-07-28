import type { MouseEventHandler } from 'react';
import { useCallback } from 'react';

/** Upstream `useDoubleClickEdit` — Alt+double-click enters edit mode. */
export function useDoubleClickEdit({
  disableEditing,
  id,
  onEdit,
}: {
  disableEditing?: boolean;
  id: string;
  onEdit: (messageId: string) => void;
}) {
  return useCallback<MouseEventHandler<HTMLDivElement>>(
    (e) => {
      if (disableEditing || !e.altKey) return;
      e.preventDefault();
      onEdit(id);
    },
    [disableEditing, id, onEdit],
  );
}
