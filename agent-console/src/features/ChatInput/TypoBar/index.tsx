import type { IEditor } from '@lobehub/editor';
import { ChatInputActionBar, ChatInputActions, useEditorState } from '@lobehub/editor/react';
import { memo, useMemo } from 'react';

import { useInputStore } from '../../../stores';
import { usePermission } from '../../../hooks/usePermission';
import { buildTypoBarItems } from './buildTypoBarItems';
import { typoBarContainerStyle } from './typoBarStyles';

/** §C.57*/
export const TypoBar = memo(function TypoBar() {
  const visible = useInputStore((s) => s.typoBarVisible);
  const editor = useInputStore((s) => s.mainEditor);
  const editorState = useEditorState(editor ?? undefined);
  const { allowed: canCreate } = usePermission('create_content');

  const items = useMemo(
    () => buildTypoBarItems(editorState, canCreate),
    [canCreate, editorState],
  );

  if (!visible) return null;

  return (
    <ChatInputActionBar
      left={<ChatInputActions items={items} />}
      style={typoBarContainerStyle}
    />
  );
});

TypoBar.displayName = 'TypoBar';

/** EditorModal 常显 TypoBar — 接受外部 editor 实例 */
export const TypoBarForEditor = memo<{ editor?: IEditor }>(function TypoBarForEditor({
  editor,
}) {
  const editorState = useEditorState(editor);
  const { allowed: canCreate } = usePermission('create_content');
  const items = useMemo(
    () => buildTypoBarItems(editorState, canCreate),
    [canCreate, editorState],
  );

  return (
    <ChatInputActionBar
      left={<ChatInputActions items={items} />}
      style={typoBarContainerStyle}
    />
  );
});

TypoBarForEditor.displayName = 'TypoBarForEditor';
