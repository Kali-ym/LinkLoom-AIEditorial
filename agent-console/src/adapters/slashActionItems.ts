import Fuse from 'fuse.js';

import type { SkillCatalog } from '../domain/types/skill';
import { filterBindingsByPlugins } from '../domain/utils/agentPluginBindings';
import type {
  SlashCatalogItem,
  SlashTriggerPosition,
} from '../domain/types/slashCatalog';

export type { SlashCatalogItem, SlashTriggerPosition };

export interface BuildSlashCatalogOptions {
  activeTopicId: string | null;
  projectSkillsEnabled: boolean;
  /** Console「工具与技能」开关；传入时仅展示已启用项。 */
  enabledPlugins?: Record<string, boolean>;
}

const FUSE_OPTIONS = { keys: ['key', 'label'] as ('key' | 'label')[], threshold: 0.4 };

/** Fuse filter aligned with `useSlashActionItems`. */
export function filterSlashCatalogItems(
  items: SlashCatalogItem[],
  query: string,
): SlashCatalogItem[] {
  if (!query) return items;
  const fuse = new Fuse(items, FUSE_OPTIONS);
  return fuse.search(query).map((r) => r.item);
}

/** Build slash menu catalog from domain skill catalog (no fixtures import). */
export function buildSlashCatalogItems(
  catalog: SkillCatalog,
  position: SlashTriggerPosition,
  options: BuildSlashCatalogOptions,
): SlashCatalogItem[] {
  if (!position.isAtLineStart && !position.isMidLineAfterWhitespace) return [];

  const items: SlashCatalogItem[] = [];

  if (position.isAtLineStart) {
    for (const cmd of catalog.commands) {
      if (cmd.type === 'newTopic' && !options.activeTopicId) continue;
      items.push({
        key: `action-${cmd.type}`,
        label: cmd.label,
        category: 'command',
        type: cmd.type,
        description: cmd.desc,
      });
    }
  }

  const enabledPlugins = options.enabledPlugins;
  const userSkills = enabledPlugins
    ? filterBindingsByPlugins(catalog.userSkills, enabledPlugins)
    : catalog.userSkills;
  const agentSkills = enabledPlugins
    ? filterBindingsByPlugins(catalog.agentSkills, enabledPlugins)
    : catalog.agentSkills;
  const projectSkills = enabledPlugins
    ? filterBindingsByPlugins(catalog.projectSkills, enabledPlugins)
    : catalog.projectSkills;

  for (const skill of userSkills) {
    items.push({
      key: `skill-${skill.id}`,
      label: skill.name,
      category: 'skill',
      type: skill.id,
      description: skill.description,
    });
  }

  for (const skill of agentSkills) {
    items.push({
      key: `agent-skill-${skill.id}`,
      label: skill.name,
      category: 'agentSkill',
      type: skill.id,
      description: skill.description,
    });
  }

  if (options.projectSkillsEnabled) {
    for (const skill of projectSkills) {
      items.push({
        key: `project-skill-${skill.name}`,
        label: skill.name,
        category: 'projectSkill',
        type: skill.name,
        description: skill.description,
      });
    }
  }

  return items;
}
