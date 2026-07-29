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
    if (categories.length === 0) return [];

    // 远程模式下按类目串行会把 RTT 乘上去；并行拉取后在本地截断。
    const batches = await Promise.all(
      categories.map((category) =>
        agentConsoleGetJson<KbDocumentDto[]>(
          `/api/kb/documents?categoryId=${encodeURIComponent(category.id)}`,
        )
          .then((docs) =>
            docs.map((doc) => {
              const name = doc.fileName?.trim() || doc.name;
              return {
                id: doc.id,
                name,
                path: `${category.name}/${name}`,
              };
            }),
          )
          .catch(() => [] as Array<{ id: string; name: string; path: string }>),
      ),
    );

    const docs = batches.flat().slice(0, limit);
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
