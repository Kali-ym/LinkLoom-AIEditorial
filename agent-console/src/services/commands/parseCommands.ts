import type { ActionTagCategory } from '../../domain/types/actionTag';

export interface ParsedActionTag {
  category: ActionTagCategory;
  label: string;
  type: string;
}

/** Walk Lexical JSON for action-tag nodes*/
export function parseActionTagsFromEditorData(
  editorData: Record<string, unknown> | undefined,
): ParsedActionTag[] {
  if (!editorData) return [];
  const tags: ParsedActionTag[] = [];
  walkNode(editorData.root, tags);
  return tags;
}

export function parseCommandsFromEditorData(
  editorData: Record<string, unknown> | undefined,
): ParsedActionTag[] {
  return parseActionTagsFromEditorData(editorData).filter((tag) => tag.category === 'command');
}

function walkNode(node: unknown, out: ParsedActionTag[]): void {
  if (!node || typeof node !== 'object') return;
  const record = node as Record<string, unknown>;

  if (record.type === 'action-tag') {
    out.push({
      category: record.actionCategory as ActionTagCategory,
      label: String(record.actionLabel ?? ''),
      type: String(record.actionType ?? ''),
    });
  }

  const children = record.children;
  if (Array.isArray(children)) {
    for (const child of children) {
      walkNode(child, out);
    }
  }
}
