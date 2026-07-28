import { memo, useCallback } from 'react';

import { useInputStore } from '../../../../stores';
import { PromptTransformAction } from '../../../PromptTransform/PromptTransformAction';

/** §C.38 promptTransform*/
export const PromptTransform = memo(function PromptTransform() {
  const editor = useInputStore((s) => s.mainEditor);
  const markdownContent = useInputStore((s) => s.markdownContent);

  const onPromptChange = useCallback(
    (prompt: string) => {
      if (!editor) return;
      editor.setDocument('markdown', prompt, { keepHistory: true });
    },
    [editor],
  );

  return (
    <PromptTransformAction
      mode="image"
      prompt={markdownContent}
      onPromptChange={onPromptChange}
    />
  );
});
