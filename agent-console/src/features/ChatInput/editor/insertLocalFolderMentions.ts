import type { IEditor } from '@lobehub/editor';
import { INSERT_MENTION_COMMAND } from '@lobehub/editor';
import { $getSelection, $isRangeSelection } from 'lexical';

import type { DroppedFolder } from '../../../components/DragUploadZone';

/** §C.49*/
export function insertLocalFolderMentions(editor: IEditor, folders: DroppedFolder[]) {
  if (folders.length === 0) return;

  const lexicalEditor = editor.getLexicalEditor();
  lexicalEditor?.focus();

  folders.forEach((folder, index) => {
    if (index > 0) {
      lexicalEditor?.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          selection.insertText(' ');
        }
      });
    }
    editor.dispatchCommand(INSERT_MENTION_COMMAND, {
      label: folder.name,
      metadata: {
        isDirectory: true,
        name: folder.name,
        path: folder.path,
        type: 'localFile',
      },
    });
  });

  lexicalEditor?.update(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      selection.insertText(' ');
    }
  });
}
