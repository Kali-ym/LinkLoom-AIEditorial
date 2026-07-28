import type { IEditor } from '@lobehub/editor';
import { $getRoot, $isElementNode, type LexicalNode } from 'lexical';

import {
  stripEmbedMediaFromEditorData,
  stripUploadMediaFromMarkdown,
} from '../../../utils/uploadMessageContent';

const EMBED_MEDIA_NODE_TYPES = new Set([
  'image',
  'inline-image',
  'image-block',
  'upload-image',
  'file',
  'attachment',
]);

export { stripEmbedMediaFromEditorData, stripUploadMediaFromMarkdown };

/** Drop embedded upload nodes from the live editor after files go to ContextContainer. */
export function removeEmbedMediaFromEditor(editor: IEditor | null | undefined): void {
  const lexical = editor?.getLexicalEditor();
  if (!lexical) return;

  lexical.update(() => {
    const pending: LexicalNode[] = [];

    const walk = (node: LexicalNode) => {
      if (EMBED_MEDIA_NODE_TYPES.has(node.getType())) {
        pending.push(node);
        return;
      }
      if ($isElementNode(node)) {
        for (const child of node.getChildren()) {
          walk(child);
        }
      }
    };

    walk($getRoot());
    for (const node of pending) {
      node.remove();
    }
  });
}

export function readEditorSendPayload(editor: IEditor | null): {
  message: string;
  editorData?: Record<string, unknown>;
} {
  if (!editor || editor.isEmpty) return { message: '' };

  const rawEditorData = editor.getDocument('json') as unknown as Record<string, unknown>;
  const editorData = stripEmbedMediaFromEditorData(rawEditorData);
  const markdownDoc = editor.getDocument('markdown') as unknown;
  const markdown =
    typeof markdownDoc === 'string' ? markdownDoc : markdownDoc != null ? String(markdownDoc) : '';

  return {
    message: stripUploadMediaFromMarkdown(markdown),
    editorData,
  };
}
