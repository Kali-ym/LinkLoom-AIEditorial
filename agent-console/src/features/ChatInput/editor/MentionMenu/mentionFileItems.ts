import type { ISlashMenuOption } from '@lobehub/editor';

import {
  mapAgentFilesToMentionFiles,
  mergeMentionFiles,
} from '../../../../domain/utils/mentionMenuItems';
import type { AgentAttachmentFile } from '../../../../domain/types/agentChatConfig';
import type { MentionMenuItemData } from '../../../../domain/types/inputMenu';

export function buildMentionFileMenuItems(options: {
  agentFiles: AgentAttachmentFile[];
  storedFiles: MentionMenuItemData[];
}): ISlashMenuOption[] {
  const merged = mergeMentionFiles(
    mapAgentFilesToMentionFiles(options.agentFiles, { enabledOnly: true }),
    options.storedFiles,
  );

  return merged.map((item) => ({
    key: `file-${item.type}`,
    label: item.label,
    metadata: {
      id: item.type,
      name: item.label,
      path: item.path ?? item.label,
      timestamp: 0,
      type: 'localFile' as const,
    },
  }));
}
