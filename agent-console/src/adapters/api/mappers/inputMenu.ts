import type { Agent } from '../../../domain/types';
import type { InputMenuData, MentionMenuItemData } from '../../../domain/types/inputMenu';
import type { Topic } from '../../../domain/types/topic';
import {
  mapAgentFilesToMentionFiles,
  mapKbDocumentsToMentionFiles,
  mergeMentionFiles,
} from '../../../domain/utils/mentionMenuItems';
import { agentConsoleGetJson } from '../http';
import type { KbCategoryDto, KbDocumentDto } from './kbDocuments';

export { mapAgentFilesToMentionFiles, mapKbDocumentsToMentionFiles, mergeMentionFiles };

const DEFAULT_MENTION_FILE_LIMIT = 12;

export async function fetchKbDocumentsForMention(
  limit = DEFAULT_MENTION_FILE_LIMIT,
): Promise<MentionMenuItemData[]> {
  try {
    const categories = await agentConsoleGetJson<KbCategoryDto[]>('/api/kb/categories');
    const docs: Array<{ id: string; name: string; path: string }> = [];

    for (const category of categories) {
      if (docs.length >= limit) break;
      const batch = await agentConsoleGetJson<KbDocumentDto[]>(
        `/api/kb/documents?categoryId=${encodeURIComponent(category.id)}`,
      );
      for (const doc of batch) {
        if (docs.length >= limit) break;
        const name = doc.fileName?.trim() || doc.name;
        docs.push({
          id: doc.id,
          name,
          path: `${category.name}/${name}`,
        });
      }
    }

    return mapKbDocumentsToMentionFiles(docs, limit);
  } catch {
    return [];
  }
}

export function mapAgentsTopicsToInputMenu(
  agents: Agent[],
  topics: Topic[],
  mentionFiles: MentionMenuItemData[] = [],
): InputMenuData {
  const mentionTopics = topics
    .filter((t) => t.status !== 'temp' && t.title.trim())
    .slice(0, 12)
    .map((topic) => ({
      kind: 'topic' as const,
      label: topic.title,
      type: topic.id,
    }));

  const mentionRecent = agents.slice(0, 8).map((agent) => ({
    kind: 'agent' as const,
    label: agent.name,
    type: agent.id,
    gradient: agent.gradient,
  }));

  return {
    mentionTopics,
    mentionFiles,
    mentionRecent,
  };
}
