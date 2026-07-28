import { Input } from '@lobehub/ui';
import { memo, useCallback, useEffect, useState } from 'react';

import { useTaskDetailPageStore } from '../../stores/taskDetailPageStore';

/** §C.54*/
export const TaskDetailTitleInput = memo(function TaskDetailTitleInput() {
  const detail = useTaskDetailPageStore((s) => s.detail);
  const updateTitle = useTaskDetailPageStore((s) => s.updateTitle);
  const [draft, setDraft] = useState(detail?.title ?? '');

  useEffect(() => {
    setDraft(detail?.title ?? '');
  }, [detail?.title, detail?.id]);

  const commit = useCallback(() => {
    const next = draft.trim();
    if (!next || !detail || next === detail.title) return;
    updateTitle(next);
  }, [detail, draft, updateTitle]);

  if (!detail) return null;

  return (
    <Input
      size="large"
      value={draft}
      variant="borderless"
      style={{ fontSize: 22, fontWeight: 600, padding: 0 }}
      onBlur={commit}
      onChange={(e) => setDraft(e.target.value)}
      onPressEnter={commit}
    />
  );
});
