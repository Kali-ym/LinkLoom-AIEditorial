import type { IEditor } from '@lobehub/editor';
import { $getSelection, $isRangeSelection, $isTextNode } from 'lexical';

export function readEditorMarkdown(editor: IEditor | null): string {
  if (!editor || editor.isEmpty) return '';
  const doc = editor.getDocument('markdown') as unknown;
  if (typeof doc === 'string') return doc;
  if (doc != null) return String(doc);
  return '';
}

export function readEditorPlainText(editor: IEditor | null): string {
  if (!editor || editor.isEmpty) return '';
  const doc = editor.getDocument('text') as unknown;
  if (typeof doc === 'string') return doc;
  if (doc != null) return String(doc);
  return '';
}

function stripTriggerAtCursor(editor: IEditor, trigger: '/' | '@') {
  const lexical = editor.getLexicalEditor();
  if (!lexical) return;
  lexical.update(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return;
    const anchor = selection.anchor;
    const node = anchor.getNode();
    if (!$isTextNode(node)) return;
    const text = node.getTextContent();
    const offset = anchor.offset;
    const before = text.slice(0, offset);
    const triggerIdx = before.lastIndexOf(trigger);
    if (triggerIdx < 0) return;
    const newBefore = before.slice(0, triggerIdx);
    const after = text.slice(offset);
    const merged = newBefore + after;
    if (!merged) {
      node.remove();
      return;
    }
    node.setTextContent(merged);
    const caret = newBefore.length;
    selection.setTextNodeRange(node, caret, node, caret);
  });
}

export function stripSlashTrigger(editor: IEditor) {
  stripTriggerAtCursor(editor, '/');
}

export function stripMentionTrigger(editor: IEditor) {
  stripTriggerAtCursor(editor, '@');
}

export function appendAtCursor(editor: IEditor, chunk: string) {
  const lexical = editor.getLexicalEditor();
  if (!lexical) return;
  lexical.update(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      selection.insertText(chunk);
    }
  });
  editor.focus();
}
