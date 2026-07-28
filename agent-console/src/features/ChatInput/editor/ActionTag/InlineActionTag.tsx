import { CLICK_COMMAND, COMMAND_PRIORITY_LOW, type LexicalEditor } from 'lexical';
import { memo, useCallback, useEffect, useRef } from 'react';

import { ActionTag } from '../../ActionTag';
import type { ActionTagNode } from '../../../shared/editor';

interface InlineActionTagProps {
  editor: LexicalEditor;
  node: ActionTagNode;
}

/** Decorator for ActionTagNode — inline chip inside the editor content area. */
export const InlineActionTag = memo<InlineActionTagProps>(function InlineActionTag({ node, editor }) {
  const spanRef = useRef<HTMLSpanElement>(null);

  const onClick = useCallback((payload: MouseEvent) => {
    if (payload.target === spanRef.current || spanRef.current?.contains(payload.target as Node)) {
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    return editor.registerCommand(CLICK_COMMAND, onClick, COMMAND_PRIORITY_LOW);
  }, [editor, onClick]);

  return (
    <span ref={spanRef} style={{ verticalAlign: -3 }}>
      <ActionTag
        payload={{
          category: node.actionCategory,
          label: node.actionLabel,
          type: node.actionType,
        }}
      />
    </span>
  );
});
