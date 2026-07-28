import type { IEditor } from '@lobehub/editor';
import { memo, useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

import { showToast } from '../../services/ui/toast';
import {
  copyEditorSelection,
  cutEditorSelection,
  pasteIntoEditor,
  selectAllEditor,
} from './editor/editorClipboardActions';
import { bindFloatingReposition, clearFloatingMenuStyles, measureFloatingMenu, positionAtPoint } from '../../utils/floatingMenu';

/** index.html `#editorContextMenu` */
export const EditorContextMenu = memo(function EditorContextMenu({
  editorRef,
  pos,
  onClose,
}: {
  editorRef: RefObject<IEditor | null>;
  pos: { left: number; top: number } | null;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!pos || !menuRef.current) {
      if (menuRef.current) clearFloatingMenuStyles(menuRef.current);
      return;
    }
    const menu = menuRef.current;
    const reposition = () => {
      measureFloatingMenu(menu, () => positionAtPoint(menu, pos.left, pos.top));
    };
    reposition();
    return bindFloatingReposition(reposition);
  }, [pos]);

  useEffect(() => {
    if (!pos) return;
    const onDocClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [pos, onClose]);

  const run = useCallback(
    (action: string) => {
      const editor = editorRef.current;
      onClose();
      if (!editor) return;

      void (async () => {
        switch (action) {
          case 'paste': {
            const ok = await pasteIntoEditor(editor);
            if (!ok) showToast('粘贴失败');
            break;
          }
          case 'cut': {
            const ok = await cutEditorSelection(editor);
            if (!ok) showToast('剪切失败');
            break;
          }
          case 'copy': {
            const ok = await copyEditorSelection(editor);
            if (!ok) showToast('复制失败');
            break;
          }
          case 'selectAll':
            selectAllEditor(editor);
            break;
          case 'clear':
            editor.cleanDocument();
            showToast('已清空输入');
            break;
        }
      })();
    },
    [editorRef, onClose],
  );

  if (!pos) return null;

  return (
    <div
      ref={menuRef}
      className="editor-context-menu open"
      id="editorContextMenu"
      role="menu"
    >
      <button className="ctx-item" type="button" onClick={() => run('paste')}>粘贴</button>
      <button className="ctx-item" type="button" onClick={() => run('cut')}>剪切</button>
      <button className="ctx-item" type="button" onClick={() => run('copy')}>复制</button>
      <div className="plus-divider" />
      <button className="ctx-item" type="button" onClick={() => run('selectAll')}>全选</button>
      <button className="ctx-item" type="button" onClick={() => run('clear')}>清空输入</button>
    </div>
  );
});
