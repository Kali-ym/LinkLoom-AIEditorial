import type { IEditor, SlashOptions } from '@lobehub/editor';
import { SkillsIcon } from '@lobehub/ui/icons';
import { ArchiveIcon, MessageSquarePlusIcon } from 'lucide-react';
import { useCallback, useRef } from 'react';

import {
  buildSlashCatalogItems,
  filterSlashCatalogItems,
  type SlashCatalogItem,
} from '../../../../hooks/data/useCatalog';
import { useInputStore, useAgentStore, useTopicStore, useWorkspaceStore } from '../../../../stores';
import { INSERT_ACTION_TAG_COMMAND, type InsertActionTagPayload } from './command';
import { detectSlashTriggerPosition } from './detectSlashTrigger';
import { SLASH_COMMAND_LABELS } from './types';

type SlashItem = NonNullable<
  SlashOptions['items'] extends (...args: never[]) => infer R
    ? Awaited<R> extends (infer U)[]
      ? U
      : never
    : never
>;

const COMMAND_ICONS: Record<string, typeof ArchiveIcon> = {
  compact: ArchiveIcon,
  newTopic: MessageSquarePlusIcon,
};

function toSlashOption(item: SlashCatalogItem): SlashItem {
  const payload: InsertActionTagPayload = {
    category: item.category,
    label: item.label,
    type: item.type,
  };

  return {
    icon: item.category === 'command' ? COMMAND_ICONS[item.type] : SkillsIcon,
    key: item.key,
    label: item.label,
    metadata: {
      category: item.category,
      description: item.description,
      type: item.type,
    },
    onSelect: (editor: IEditor) => {
      editor.dispatchCommand(INSERT_ACTION_TAG_COMMAND, payload);
    },
  } as SlashItem;
}

/** §C.31*/
export function useSlashActionItems(): SlashOptions['items'] {
  const activeTopicId = useTopicStore((s) => s.activeTopicId);
  const skillCatalog = useWorkspaceStore((s) => s.skillCatalog);
  const workingDir = useWorkspaceStore((s) => s.workingDir);
  const enabledPlugins = useAgentStore((s) => s.getActivePlusState().plugins);
  const projectSkillsEnabled = !!workingDir;

  const contextRef = useRef({
    activeTopicId,
    enabledPlugins,
    projectSkillsEnabled,
    skillCatalog,
  });
  contextRef.current = { activeTopicId, enabledPlugins, projectSkillsEnabled, skillCatalog };

  return useCallback(
    async (
      search: { leadOffset: number; matchingString: string; replaceableString: string } | null,
    ) => {
      const editorInstance = useInputStore.getState().mainEditor;
      const {
        activeTopicId: topicId,
        enabledPlugins,
        projectSkillsEnabled: skillsEnabled,
        skillCatalog: catalog,
      } = contextRef.current;

      const position = detectSlashTriggerPosition(editorInstance, search);
      if (!position.isAtLineStart && !position.isMidLineAfterWhitespace) return [];

      let catalogItems = buildSlashCatalogItems(catalog, position, {
        activeTopicId: topicId,
        enabledPlugins,
        projectSkillsEnabled: skillsEnabled,
      });

      if (search?.matchingString) {
        catalogItems = filterSlashCatalogItems(catalogItems, search.matchingString);
      }

      return catalogItems.map((item) => {
        const label =
          item.category === 'command'
            ? (SLASH_COMMAND_LABELS[item.type] ?? item.label)
            : item.label;
        return toSlashOption({ ...item, label });
      });
    },
    [],
  );
}
