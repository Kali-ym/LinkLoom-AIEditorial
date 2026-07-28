import type { AgentPlusState } from '../../../domain/types';

export type BackendAgentResourceType = 'kb_category' | 'kb_document' | 'file';

export interface BackendAgentResourceBindingDto {
  id: string;
  agentId: string;
  resourceType: BackendAgentResourceType;
  resourceId: string;
  createdAt: number;
  metadata?: Record<string, unknown>;
}

export interface BackendBindingsListDto {
  bindings: BackendAgentResourceBindingDto[];
}

export interface KbCategoryNameDto {
  id: string;
  name: string;
}

export function resolveBindingResourceTypeForKnowledge(): 'kb_category' {
  return 'kb_category';
}

export function resolveBindingResourceTypeForFile(): 'file' {
  return 'file';
}

export function mergeBindingsIntoPlusState(
  state: AgentPlusState,
  bindings: BackendAgentResourceBindingDto[],
  kbCategories?: KbCategoryNameDto[],
): AgentPlusState {
  const boundKb = new Set(
    bindings
      .filter((binding) => binding.resourceType === 'kb_category')
      .map((binding) => binding.resourceId),
  );
  const boundFiles = new Set(
    bindings.filter((binding) => binding.resourceType === 'file').map((binding) => binding.resourceId),
  );

  const knowledgeBases = kbCategories?.length
    ? kbCategories.map((category) => ({
        id: category.id,
        name: category.name,
        enabled: boundKb.has(category.id),
      }))
    : state.knowledgeBases.map((kb) => ({
        ...kb,
        enabled: boundKb.has(kb.id),
      }));

  const files = state.files.map((file) => ({
    ...file,
    enabled: boundFiles.has(file.id),
  }));

  return {
    ...state,
    knowledgeBases,
    files,
  };
}
