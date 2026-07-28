import type { AgentAttachmentFile } from '../types/agentChatConfig';
import type { MentionMenuItemData } from '../types/inputMenu';

const DEFAULT_MENTION_FILE_LIMIT = 12;
const MAX_MENTION_FILES = 20;

export function mapAgentFilesToMentionFiles(
  files: AgentAttachmentFile[],
  options?: { enabledOnly?: boolean; limit?: number },
): MentionMenuItemData[] {
  const limit = options?.limit ?? DEFAULT_MENTION_FILE_LIMIT;
  const filtered = files.filter((file) => !options?.enabledOnly || file.enabled);
  return filtered.slice(0, limit).map((file) => ({
    kind: 'file',
    label: file.name,
    type: file.id,
    path: file.name,
  }));
}

export function mapKbDocumentsToMentionFiles(
  docs: Array<{ id: string; name: string; path: string }>,
  limit = DEFAULT_MENTION_FILE_LIMIT,
): MentionMenuItemData[] {
  return docs.slice(0, limit).map((doc) => ({
    kind: 'file',
    label: doc.name,
    type: `kb-doc-${doc.id}`,
    path: doc.path,
  }));
}

export function mergeMentionFiles(...lists: MentionMenuItemData[][]): MentionMenuItemData[] {
  const seen = new Set<string>();
  const merged: MentionMenuItemData[] = [];

  for (const list of lists) {
    for (const item of list) {
      const key = item.path?.trim() || `${item.type}:${item.label}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }
  }

  return merged.slice(0, MAX_MENTION_FILES);
}
