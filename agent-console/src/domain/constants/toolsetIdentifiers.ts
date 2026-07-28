/**
 * Canonical Agent Console toolset identifiers (LinkLoom branding).
 * {@link resolveRegistryToolsetId} normalizes legacy ids for registry lookup.
 */
export const TOOLSET_IDS = {
  AGENT: 'linkloom-agent',
  AGENT_DOCUMENTS: 'linkloom-agent-documents',
  KNOWLEDGE_BASE: 'linkloom-knowledge-base',
  LOCAL_SYSTEM: 'linkloom-local-system',
  SKILL_STORE: 'linkloom-skill-store',
  SKILLS: 'linkloom-skills',
  USER_MEMORY: 'linkloom-user-memory',
  WEB_BROWSING: 'linkloom-web-browsing',
  MCP: 'linkloom-mcp',
  DATA: 'linkloom-data',
  WORKFLOW: 'linkloom-workflow',
  GENERIC: 'linkloom-generic',
  USER_INTERACTION: 'linkloom-user-interaction',
  ADMIN: 'linkloom-admin',
} as const;

/** Legacy shorthand / pre-LinkLoom ids → registry keys. */
const TOOLSET_ID_ALIASES: Record<string, string> = {
  'linkloom-agent': TOOLSET_IDS.AGENT,
  'linkloom-agent-documents': TOOLSET_IDS.AGENT_DOCUMENTS,
  'linkloom-knowledge-base': TOOLSET_IDS.KNOWLEDGE_BASE,
  'linkloom-local-system': TOOLSET_IDS.LOCAL_SYSTEM,
  'linkloom-skill-store': TOOLSET_IDS.SKILL_STORE,
  'linkloom-skills': TOOLSET_IDS.SKILLS,
  'linkloom-user-memory': TOOLSET_IDS.USER_MEMORY,
  'linkloom-web-browsing': TOOLSET_IDS.WEB_BROWSING,
  'web-browsing': TOOLSET_IDS.WEB_BROWSING,
};

/** Resolve toolset id to Render / Intervention registry lookup key. */
export function resolveRegistryToolsetId(identifier?: string): string | undefined {
  if (!identifier) return undefined;
  if (identifier === TOOLSET_IDS.MCP) return 'codex';
  return TOOLSET_ID_ALIASES[identifier] ?? identifier;
}
