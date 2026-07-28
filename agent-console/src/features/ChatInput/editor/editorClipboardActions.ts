import type { IEditor } from '@lobehub/editor';
import { $getRoot, $getSelection, $isRangeSelection } from 'lexical';

import { appendAtCursor } from './editorText';

function getSelectedPlainText(editor: IEditor): string {
  const lexical = editor.getLexicalEditor();
  if (!lexical) return '';

  return lexical.getEditorState().read(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection) || selection.isCollapsed()) return '';
    return selection.getTextContent();
  });
}

function execCommandOnEditorRoot(editor: IEditor, command: 'copy' | 'cut' | 'paste'): boolean {
  const root = editor.getLexicalEditor()?.getRootElement();
  if (!root) return false;
  editor.focus();
  root.focus();
  return document.execCommand(command);
}

export async function copyEditorSelection(editor: IEditor): Promise<boolean> {
  const selected = getSelectedPlainText(editor);
  if (!selected) {
    return execCommandOnEditorRoot(editor, 'copy');
  }

  editor.focus();
  try {
    await navigator.clipboard.writeText(selected);
    return true;
  } catch {
    return execCommandOnEditorRoot(editor, 'copy');
  }
}

export async function cutEditorSelection(editor: IEditor): Promise<boolean> {
  const selected = getSelectedPlainText(editor);
  if (!selected) {
    return execCommandOnEditorRoot(editor, 'cut');
  }

  editor.focus();
  try {
    await navigator.clipboard.writeText(selected);
  } catch {
    if (!execCommandOnEditorRoot(editor, 'cut')) return false;
    return true;
  }

  const lexical = editor.getLexicalEditor();
  if (!lexical) return false;

  lexical.update(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      selection.removeText();
    }
  });
  return true;
}

export async function pasteIntoEditor(editor: IEditor): Promise<boolean> {
  editor.focus();

  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      appendAtCursor(editor, text);
      return true;
    }
  } catch {
    // fall through to execCommand
  }

  return execCommandOnEditorRoot(editor, 'paste');
}

export function selectAllEditor(editor: IEditor): boolean {
  const lexical = editor.getLexicalEditor();
  if (!lexical) return false;

  editor.focus();
  lexical.update(() => {
    $getRoot().select();
  });
  return true;
}
