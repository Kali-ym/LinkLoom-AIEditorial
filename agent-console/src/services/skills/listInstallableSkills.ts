import type { SkillCatalog } from '../../domain/types/skill';

export interface InstallableSkillItem {
  id: string;
  name: string;
  description: string;
}

/** Catalog entries not yet enabled on the active agent. */
export function listInstallableSkills(
  catalog: SkillCatalog,
  enabledPlugins: Record<string, boolean>,
): InstallableSkillItem[] {
  const seen = new Set<string>();
  const items: InstallableSkillItem[] = [];

  const candidates = [
    ...catalog.userSkills.map((skill) => ({
      id: skill.id,
      name: skill.name,
      description: skill.description,
    })),
    ...catalog.projectSkills.map((skill) => ({
      id: skill.id,
      name: skill.name,
      description: skill.description,
    })),
    ...catalog.agentSkills.map((skill) => ({
      id: skill.id,
      name: skill.name,
      description: skill.description,
    })),
  ];

  for (const skill of candidates) {
    if (seen.has(skill.id) || enabledPlugins[skill.id]) continue;
    seen.add(skill.id);
    items.push(skill);
  }

  return items;
}
