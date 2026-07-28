import type { ComponentType } from 'react';

import { resolveRegistryToolsetId } from '../../../../domain/constants/toolsetIdentifiers';
import { ADMIN_WRITE_INTERVENTION_API_NAMES } from './adminInterventionConfig';
import { AdminActionConfirmIntervention } from './builtins/AdminActionConfirmIntervention';
import { SettingsPatchIntervention } from './builtins/SettingsPatchIntervention';
import { AddExperienceMemoryIntervention } from './builtins/AddExperienceMemoryIntervention';
import { AskUserQuestionIntervention } from './builtins/AskUserQuestionIntervention';
import { ClearTodosIntervention } from './builtins/ClearTodosIntervention';
import { CreatePlanIntervention } from './builtins/CreatePlanIntervention';
import { CreateTodosIntervention } from './builtins/CreateTodosIntervention';
import { EditFileIntervention } from './builtins/EditFileIntervention';
import { ExecuteCodeIntervention } from './builtins/ExecuteCodeIntervention';
import {
  ExecuteTaskIntervention,
  ExecuteTasksIntervention,
} from './builtins/GroupManagementInterventions';
import { InstallPluginIntervention } from './builtins/InstallPluginIntervention';
import {
  GlobFilesIntervention,
  GrepContentIntervention,
  ListFilesIntervention,
  ReadFileIntervention,
  RenameFileIntervention,
  SearchFilesIntervention,
} from './builtins/LocalFileInterventions';
import { MoveFilesIntervention } from './builtins/MoveFilesIntervention';
import { PickAgentsIntervention } from './builtins/PickAgentsIntervention';
import { RunCommandIntervention } from './builtins/RunCommandIntervention';
import { SaveUserQuestionIntervention } from './builtins/SaveUserQuestionIntervention';
import { WriteFileIntervention } from './builtins/WriteFileIntervention';
import type { BuiltinInterventionProps } from './types';
import { listBuiltinInterventionMeta } from './registryMeta';

type BuiltinInterventionComponent = ComponentType<BuiltinInterventionProps>;

const ADMIN_INTERVENTION_REGISTRY = Object.fromEntries(
  ADMIN_WRITE_INTERVENTION_API_NAMES.map((apiName) => [
    apiName,
    apiName === 'updateSettings' ? SettingsPatchIntervention : AdminActionConfirmIntervention,
  ]),
) as Record<string, BuiltinInterventionComponent>;

/**
 * §C.36
 * 对齐 `packages/builtin-tools/src/interventions.ts`（含 legacy apiName 别名）
 */
const REGISTRY: Record<string, Record<string, BuiltinInterventionComponent>> = {
  'linkloom-agent-builder': {
    installPlugin: InstallPluginIntervention,
  },
  'claude-code': {
    askUserQuestion: AskUserQuestionIntervention,
  },
  'linkloom-cloud-sandbox': {
    editFile: EditFileIntervention,
    editLocalFile: EditFileIntervention,
    executeCode: ExecuteCodeIntervention,
    moveFiles: MoveFilesIntervention,
    moveLocalFiles: MoveFilesIntervention,
    runCommand: RunCommandIntervention,
    writeFile: WriteFileIntervention,
    writeLocalFile: WriteFileIntervention,
  },
  'linkloom-group-management': {
    executeAgentTask: ExecuteTaskIntervention,
    executeAgentTasks: ExecuteTasksIntervention,
  },
  'linkloom-agent': {
    clearTodos: ClearTodosIntervention,
    createPlan: CreatePlanIntervention,
    createTodos: CreateTodosIntervention,
  },
  'linkloom-local-system': {
    editFile: EditFileIntervention,
    editLocalFile: EditFileIntervention,
    globFiles: GlobFilesIntervention,
    globLocalFiles: GlobFilesIntervention,
    grepContent: GrepContentIntervention,
    listFiles: ListFilesIntervention,
    listLocalFiles: ListFilesIntervention,
    moveFiles: MoveFilesIntervention,
    moveLocalFiles: MoveFilesIntervention,
    readFile: ReadFileIntervention,
    readLocalFile: ReadFileIntervention,
    renameLocalFile: RenameFileIntervention,
    runCommand: RunCommandIntervention,
    searchFiles: SearchFilesIntervention,
    searchLocalFiles: SearchFilesIntervention,
    writeFile: WriteFileIntervention,
    writeLocalFile: WriteFileIntervention,
  },
  'linkloom-user-memory': {
    addExperienceMemory: AddExperienceMemoryIntervention,
  },
  'linkloom-user-interaction': {
    askUserQuestion: AskUserQuestionIntervention,
  },
  'linkloom-web-onboarding': {
    saveUserQuestion: SaveUserQuestionIntervention,
    showAgentMarketplace: PickAgentsIntervention,
  },
  'linkloom-admin': ADMIN_INTERVENTION_REGISTRY,
};

export function getBuiltinIntervention(
  identifier: string,
  apiName: string,
): BuiltinInterventionComponent | undefined {
  const registryId = resolveRegistryToolsetId(identifier) ?? identifier;
  return REGISTRY[registryId]?.[apiName];
}

export function listBuiltinInterventionEntries(): Array<{ identifier: string; apiName: string }> {
  return listBuiltinInterventionMeta();
}
