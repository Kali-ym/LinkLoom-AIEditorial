import { appendAtCursor } from '../../features/ChatInput/editor/editorText';
import { useInputStore } from '../../stores/inputStore';

function formatBlockquote(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  return `${trimmed
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n')}\n\n`;
}

/** Insert a markdown blockquote at the chat input cursor (or append to draft). */
export function quoteMessageIntoInput(text: string): boolean {
  const chunk = formatBlockquote(text);
  if (!chunk) return false;

  const editor = useInputStore.getState().mainEditor;
  if (editor) {
    appendAtCursor(editor, chunk);
    return true;
  }

  const draft = useInputStore.getState().draft.trim();
  useInputStore.getState().setDraft(draft ? `${draft}\n\n${chunk}` : chunk);
  return true;
}
