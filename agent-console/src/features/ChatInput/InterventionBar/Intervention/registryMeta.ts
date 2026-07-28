/** §C.36*/
import { ADMIN_WRITE_INTERVENTION_API_NAMES } from './adminInterventionConfig';

export const BUILTIN_INTERVENTION_APIS: Record<string, readonly string[]> = {
  'linkloom-agent-builder': ['installPlugin'],
  'claude-code': ['askUserQuestion'],
  'linkloom-cloud-sandbox': [
    'editFile',
    'editLocalFile',
    'executeCode',
    'moveFiles',
    'moveLocalFiles',
    'runCommand',
    'writeFile',
    'writeLocalFile',
  ],
  'linkloom-group-management': ['executeAgentTask', 'executeAgentTasks'],
  'linkloom-agent': ['clearTodos', 'createPlan', 'createTodos'],
  'linkloom-local-system': [
    'editFile',
    'editLocalFile',
    'globFiles',
    'globLocalFiles',
    'grepContent',
    'listFiles',
    'listLocalFiles',
    'moveFiles',
    'moveLocalFiles',
    'readFile',
    'readLocalFile',
    'renameLocalFile',
    'runCommand',
    'searchFiles',
    'searchLocalFiles',
    'writeFile',
    'writeLocalFile',
  ],
  'linkloom-user-memory': ['addExperienceMemory'],
  'linkloom-user-interaction': ['askUserQuestion'],
  'linkloom-web-onboarding': ['saveUserQuestion', 'showAgentMarketplace'],
  'linkloom-admin': ADMIN_WRITE_INTERVENTION_API_NAMES,
};

export function listBuiltinInterventionMeta(): Array<{ identifier: string; apiName: string }> {
  return Object.entries(BUILTIN_INTERVENTION_APIS).flatMap(([identifier, apis]) =>
    apis.map((apiName) => ({ apiName, identifier })),
  );
}
