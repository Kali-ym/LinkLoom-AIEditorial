import { $wrapNodeInElement } from '@lexical/utils';
import {
  $createParagraphNode,
  $createTextNode,
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  $isRootOrShadowRoot,
  COMMAND_PRIORITY_HIGH,
  createCommand,
  type LexicalCommand,
  type LexicalEditor,
} from 'lexical';

import { $createActionTagNode } from '../../../shared/editor';
import type { ActionTagCategory, ActionTagType } from './types';

export interface InsertActionTagPayload {
  category: ActionTagCategory;
  label: string;
  type: ActionTagType;
}

export const INSERT_ACTION_TAG_COMMAND: LexicalCommand<InsertActionTagPayload> = createCommand(
  'INSERT_ACTION_TAG_COMMAND',
);

export function registerActionTagCommand(editor: LexicalEditor): () => void {
  return editor.registerCommand(
    INSERT_ACTION_TAG_COMMAND,
    (payload) => {
      editor.update(() => {
        const node = $createActionTagNode(payload.type, payload.category, payload.label);
        $insertNodes([node]);
        if ($isRootOrShadowRoot(node.getParentOrThrow())) {
          $wrapNodeInElement(node, $createParagraphNode).selectEnd();
        }
        const space = $createTextNode('\u00a0');
        $insertNodes([space]);
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          selection.setTextNodeRange(space, space.getTextContentSize(), space, space.getTextContentSize());
        }
      });
      return true;
    },
    COMMAND_PRIORITY_HIGH,
  );
}
