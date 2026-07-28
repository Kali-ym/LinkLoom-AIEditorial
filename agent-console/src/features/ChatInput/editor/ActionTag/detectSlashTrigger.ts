import type { IEditor } from '@lobehub/editor';
import { $getSelection, $isRangeSelection } from 'lexical';

import type { SlashTriggerPosition } from '../../../../domain/types/slashCatalog';

/** Lexical paragraph trigger detection*/
export function detectSlashTriggerPosition(
  editor: IEditor | null,
  search: { matchingString: string } | null,
): SlashTriggerPosition {
  let isAtLineStart = search === null;
  let isMidLineAfterWhitespace = false;

  if (isAtLineStart || !editor) {
    return { isAtLineStart, isMidLineAfterWhitespace };
  }

  const lexicalEditor = editor.getLexicalEditor();
  if (!lexicalEditor) {
    return { isAtLineStart, isMidLineAfterWhitespace };
  }

  lexicalEditor.getEditorState().read(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return;
    const node = selection.anchor.getNode();
    const topElement = node.getTopLevelElement();
    if (!topElement) return;

    const paragraphText = topElement.getTextContent();
    const triggerAndSearch = '/' + (search?.matchingString ?? '');

    if (paragraphText === triggerAndSearch) {
      isAtLineStart = true;
      return;
    }

    const triggerIndex = paragraphText.lastIndexOf(triggerAndSearch);
    if (triggerIndex === 0) {
      isAtLineStart = true;
    } else if (triggerIndex > 0 && /\s/.test(paragraphText[triggerIndex - 1]!)) {
      isMidLineAfterWhitespace = true;
    }
  });

  return { isAtLineStart, isMidLineAfterWhitespace };
}
